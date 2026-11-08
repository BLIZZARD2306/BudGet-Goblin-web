// Shared helpers for the sign-in code endpoints. Files starting with "_" aren't routes on Vercel.
//
// Secrets come from Vercel's environment variables (never from this repository):
//   FIREBASE_SERVICE_ACCOUNT  the JSON key from Firebase > Project settings > Service accounts
//   GMAIL_USER                the BudGet Gmail address that sends the codes
//   GMAIL_APP_PASSWORD        an App Password for that Gmail account (needs 2-Step Verification)
//   CODE_SECRET               any long random string; codes and emails are stored only as HMACs of it
import crypto from "node:crypto";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import nodemailer from "nodemailer";

export const CODE_TTL_MS = 10 * 60 * 1000; // a code works for 10 minutes
export const MAX_ATTEMPTS = 5; // wrong guesses before a code is thrown away
export const RESEND_GAP_MS = 30 * 1000; // per email: at least 30 s between codes
export const EMAIL_SENDS_PER_HOUR = 5; // per email
export const IP_REQUESTS_PER_HOUR = 20; // per network, across all emails

let app;
export function firebase() {
  if (!app) {
    app = getApps()[0] ?? initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  }
  return { auth: getAuth(app), db: getFirestore(app) };
}

let mailer;
export function gmail() {
  mailer ??= nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  });
  return mailer;
}

/** HMAC with CODE_SECRET, so a database leak reveals neither codes nor email addresses. */
export const hmac = (value) => crypto.createHmac("sha256", process.env.CODE_SECRET).update(value).digest("hex");

export const normalizeEmail = (raw) => (typeof raw === "string" ? raw.trim().toLowerCase() : "");

// Deliberately simple: one @, something on each side, a dot in the domain, no spaces.
export const isEmail = (email) => email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export const isCode = (code) => typeof code === "string" && /^[0-9]{6}$/.test(code);

/** Vercel puts the caller's address in x-real-ip / x-forwarded-for. */
export function clientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  return req.headers["x-real-ip"] || (typeof forwarded === "string" ? forwarded.split(",")[0].trim() : "") || "unknown";
}

/** Only POST with a JSON body; answers anything else itself and returns false. */
export function acceptPost(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "method" });
    return false;
  }
  if (!req.body || typeof req.body !== "object") {
    res.status(400).json({ error: "body" });
    return false;
  }
  return true;
}

/** Firestore paths the app can never read or write (firestore.rules only opens users/{uid}). */
export const codeDoc = (db, emailKey) => db.collection("signInCodes").doc(emailKey);
export const limitDoc = (db, ipKey) => db.collection("signInLimits").doc(ipKey);

export const recent = (times, now, windowMs) => (Array.isArray(times) ? times : []).filter((t) => now - t < windowMs);
