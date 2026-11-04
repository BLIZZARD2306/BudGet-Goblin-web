# BudGet-Goblin-web

Download page for the BudGet Android app, deployed by Vercel on every push to `main`:
https://budget-goblin.vercel.app

- `index.html`: the page. Edit it here; the app repository never touches it.
- `app/latest.json`: the newest version. The app checks it on launch and the page reads it
  for the version, notes and download link. `release.ps1` in the app repository updates it.
- App files (APKs) are attached to this repository's Releases, one per version (`v1.1.2`).
