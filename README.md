# BudGet-Goblin-web

Download page for the BudGet Android app, deployed by Vercel on every push to `main`:
https://budget-goblin.vercel.app

- `index.html`: the page. Edit it here; the app repository never touches it.
- `app/latest.json`: the newest version. The app checks it on launch and the page reads it
  for the version, notes and download link. `release.ps1` in the app repository updates it.
- App files (APKs) are attached to this repository's Releases, one per version (`v1.1.2`).

## Sign-in code API (`api/`)

The app signs in with a 6-digit code sent by email. Firebase's free Spark plan has no Cloud
Functions, so these two Vercel functions do the server-side part:

- `POST /api/send-code` `{ "email" }`: rate-limits, stores a hashed code (10 minutes) in Firestore
  under `signInCodes/`, and emails it from the BudGet Gmail account.
- `POST /api/verify-code` `{ "email", "code" }`: allows 5 tries per code, then returns a Firebase
  custom token for that email's account (the existing one if there is one, so its data carries on).

Limits: 30 seconds between codes and 5 codes an hour per email; 20 requests an hour per network.
`signInCodes/` and `signInLimits/` are only reachable through the Admin SDK: `firestore.rules`
only opens `users/{uid}` to the app.

### One-time setup (Vercel > Project > Settings > Environment Variables)

| Name | Value |
| --- | --- |
| `FIREBASE_SERVICE_ACCOUNT` | Whole JSON file from Firebase console > Project settings > Service accounts > Generate new private key |
| `GMAIL_USER` | The BudGet Gmail address |
| `GMAIL_APP_PASSWORD` | Google Account > Security > 2-Step Verification (turn on) > App passwords |
| `CODE_SECRET` | Any long random string; changing it cancels codes that are waiting |

Then redeploy. Keep all four secret: never commit them or put them in the app.
