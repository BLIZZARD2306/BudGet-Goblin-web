// POST /api/send-code  { "email": "you@example.com" }
// Emails a 6-digit sign-in code, if the rate limits allow. Always answers the same way for any
// valid address, so it can't be used to find out who has a BudGet account.
import crypto from "node:crypto";
import {
  CODE_TTL_MS,
  EMAIL_SENDS_PER_HOUR,
  IP_REQUESTS_PER_HOUR,
  RESEND_GAP_MS,
  acceptPost,
  clientIp,
  codeDoc,
  firebase,
  gmail,
  hmac,
  isEmail,
  limitDoc,
  normalizeEmail,
  recent,
} from "./_lib.js";
import { codeEmail } from "./_email.js";

const HOUR = 60 * 60 * 1000;

export default async function handler(req, res) {
  if (!acceptPost(req, res)) return;
  const email = normalizeEmail(req.body.email);
  if (!isEmail(email)) return res.status(400).json({ error: "email" });

  const { db } = firebase();
  const emailKey = hmac(`email:${email}`);
  const ipKey = hmac(`ip:${clientIp(req)}`);
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  const now = Date.now();

  // Check both limits and store the new code in one transaction, so parallel requests can't slip past.
  const verdict = await db.runTransaction(async (tx) => {
    const [codeSnap, limitSnap] = await Promise.all([tx.get(codeDoc(db, emailKey)), tx.get(limitDoc(db, ipKey))]);
    const sends = recent(codeSnap.get("sends"), now, HOUR);
    const hits = recent(limitSnap.get("hits"), now, HOUR);
    if (hits.length >= IP_REQUESTS_PER_HOUR) return { error: "too_many", retryAfter: Math.ceil((hits[0] + HOUR - now) / 1000) };
    if (sends.length && now - sends[sends.length - 1] < RESEND_GAP_MS) {
      return { error: "too_soon", retryAfter: Math.ceil((sends[sends.length - 1] + RESEND_GAP_MS - now) / 1000) };
    }
    if (sends.length >= EMAIL_SENDS_PER_HOUR) return { error: "too_many", retryAfter: Math.ceil((sends[0] + HOUR - now) / 1000) };

    // A new code replaces any earlier one and starts with a fresh set of attempts.
    tx.set(codeDoc(db, emailKey), {
      hash: hmac(`code:${emailKey}:${code}`),
      expiresAt: now + CODE_TTL_MS,
      attempts: 0,
      sends: [...sends, now],
    });
    tx.set(limitDoc(db, ipKey), { hits: [...hits, now] });
    return { ok: true };
  });

  if (verdict.error) {
    res.setHeader("Retry-After", String(verdict.retryAfter));
    return res.status(429).json(verdict);
  }

  try {
    await gmail().sendMail({ from: `"BudGet" <${process.env.GMAIL_USER}>`, to: email, ...codeEmail(code) });
  } catch (e) {
    console.error("send-code: Gmail refused", e?.message);
    await codeDoc(db, emailKey).update({ hash: null }).catch(() => {}); // an unsent code must not work
    return res.status(502).json({ error: "mail" });
  }
  return res.status(200).json({ ok: true, expiresIn: CODE_TTL_MS / 1000 });
}
