// POST /api/verify-code  { "email": "you@example.com", "code": "123456" }
// Checks the code and answers with a Firebase custom token for that email's account, which the app
// passes to signInWithCustomToken. An email that already has an account (from Google or an older
// email link) signs into that same account, so its budget and sync carry on unchanged.
import crypto from "node:crypto";
import { MAX_ATTEMPTS, acceptPost, codeDoc, firebase, hmac, isCode, isEmail, normalizeEmail } from "./_lib.js";

export default async function handler(req, res) {
  if (!acceptPost(req, res)) return;
  const email = normalizeEmail(req.body.email);
  const code = typeof req.body.code === "string" ? req.body.code.replace(/\s/g, "") : "";
  if (!isEmail(email)) return res.status(400).json({ error: "email" });
  if (!isCode(code)) return res.status(400).json({ error: "wrong", attemptsLeft: null });

  const { auth, db } = firebase();
  const emailKey = hmac(`email:${email}`);
  const now = Date.now();

  const verdict = await db.runTransaction(async (tx) => {
    const ref = codeDoc(db, emailKey);
    const snap = await tx.get(ref);
    const hash = snap.get("hash");
    if (!snap.exists || !hash || snap.get("expiresAt") < now) return { error: "expired" };
    const attempts = snap.get("attempts") ?? 0;
    if (attempts >= MAX_ATTEMPTS) return { error: "locked" };

    const expected = Buffer.from(hash, "hex");
    const given = Buffer.from(hmac(`code:${emailKey}:${code}`), "hex");
    if (!crypto.timingSafeEqual(expected, given)) {
      const left = MAX_ATTEMPTS - attempts - 1;
      // The last wrong guess burns the code; the send history (rate limit) stays.
      tx.update(ref, left > 0 ? { attempts: attempts + 1 } : { attempts: attempts + 1, hash: null });
      return { error: left > 0 ? "wrong" : "locked", attemptsLeft: left };
    }
    tx.update(ref, { hash: null, attempts: 0 }); // one use only
    return { ok: true };
  });

  if (verdict.error) return res.status(verdict.error === "locked" ? 429 : 400).json(verdict);

  let user;
  try {
    user = await auth.getUserByEmail(email);
  } catch (e) {
    if (e?.code !== "auth/user-not-found") throw e;
    user = await auth.createUser({ email, emailVerified: true });
  }
  if (user.disabled) return res.status(403).json({ error: "disabled" });
  if (!user.emailVerified) await auth.updateUser(user.uid, { emailVerified: true }); // they just proved it

  const token = await auth.createCustomToken(user.uid);
  return res.status(200).json({ token });
}
