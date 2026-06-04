# Desktop release runbook

> How to ship a signed, auto-updating Tauri build of Titan Protocol.
>
> P3 of `SAAS_ROADMAP.md` is the architecture; this file is the human checklist. Everything in here is one-time setup unless noted.

---

## One-time: signing key

The updater signs each bundle with an asymmetric key. The **public** key is embedded in `src-tauri/tauri.conf.json` (`plugins.updater.pubkey`). The **private** key signs new releases in CI.

**Lose the private key = no future updates ever for existing installs.** Back it up in two encrypted locations before doing anything else.

```bash
# Generate the key pair
cd web
npx tauri signer generate -w ~/.tauri/titan-protocol-updater.key

# It will print the public key. Replace the placeholder in tauri.conf.json
#   "plugins": { "updater": { "pubkey": "<the printed string>" } }

# Back up the private file:
#   - Copy to a hardware password manager (1Password / Bitwarden / etc.)
#   - Copy to an encrypted external drive
#   - Do NOT commit it to git
```

Then add the private key to GitHub Actions secrets:

```bash
gh secret set TAURI_SIGNING_PRIVATE_KEY < ~/.tauri/titan-protocol-updater.key
gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD --body "<password-you-set>"
```

---

## One-time: macOS code-signing + notarization

Without these, macOS users see a Gatekeeper "unidentified developer" warning and have to right-click → Open. With them, the app launches cleanly. **Apple Developer Program required ($99/year).**

1. Enroll at [developer.apple.com](https://developer.apple.com/programs/enroll/).
2. In **Certificates, Identifiers & Profiles**, create a **Developer ID Application** certificate.
3. Download the `.cer`, double-click to add to Keychain.
4. Export from Keychain as `.p12` (right-click → Export → set a strong password).
5. Convert to base64:
   ```bash
   base64 -i developer-id.p12 -o developer-id.p12.b64
   ```
6. Get your **Team ID** from [Membership Details](https://developer.apple.com/account/#/membership).
7. Generate an **app-specific password** at [appleid.apple.com](https://appleid.apple.com) → Sign-In & Security → App-Specific Passwords.

Add to GitHub secrets:

```bash
gh secret set APPLE_CERTIFICATE < developer-id.p12.b64
gh secret set APPLE_CERTIFICATE_PASSWORD --body "<.p12 password>"
gh secret set APPLE_SIGNING_IDENTITY --body "Developer ID Application: Your Name (TEAMID)"
gh secret set APPLE_ID --body "your-apple-id@example.com"
gh secret set APPLE_PASSWORD --body "<app-specific-password>"
gh secret set APPLE_TEAM_ID --body "TEAMID"
```

The `tauri-action` workflow handles notarization automatically when these are set.

---

## One-time: Windows code-signing

Without a cert, Windows shows SmartScreen warnings and many users will be blocked by their IT or antivirus. **Two options:**

- **OV (Organization Validation) cert** — ~$200/year. Cheaper but starts with SmartScreen warnings until your release builds enough reputation (~tens of installs).
- **EV (Extended Validation) cert** — ~$300-500/year. Skips SmartScreen warnings from day one but requires a hardware USB token.

Recommended providers: Sectigo, DigiCert, Certum (cheapest, ~$100/year for OV).

After you get the `.pfx`:

```bash
base64 -i windows-codesign.pfx -o windows-codesign.pfx.b64
gh secret set WINDOWS_CERTIFICATE < windows-codesign.pfx.b64
gh secret set WINDOWS_CERTIFICATE_PASSWORD --body "<.pfx password>"
```

---

## One-time: update endpoint

`tauri.conf.json` is currently pointed at GitHub Releases:

```json
"endpoints": [
  "https://github.com/Arun-Sanjay/Titan-Protocol-v2/releases/latest/download/latest.json"
]
```

`tauri-action` generates the `latest.json` automatically and uploads it alongside the bundles, so no manual server work is needed. The format is documented at [tauri.app/v2/distribute/auto-update](https://tauri.app/v2/distribute/auto-update/).

If you want a custom endpoint (e.g. for stable/beta channel split), point at a Vercel route that responds with the right JSON based on a query param — but defer that until you actually need channels.

---

## The release flow

Once the setup above is done, shipping is:

```bash
# 1. Make sure the working tree is clean + on main
git status

# 2. Bump the version in src-tauri/tauri.conf.json
#    (and in package.json if you keep them in sync)
#    The tag and the conf.json version must match.

# 3. Commit + tag + push
git commit -am "release: v0.2.0"
git tag v0.2.0
git push origin main v0.2.0

# 4. Watch the workflow at github.com/<repo>/actions
#    It builds for macOS (universal), Windows, Linux in parallel.
#    Each platform's job uploads signed installers + the latest.json.

# 5. After CI passes:
#    - existing installs auto-update on next launch
#    - new users grab the bundle from the GitHub Release page
```

---

## Smoke test before tagging

Catch problems before the workflow runs:

```bash
# Local build — produces unsigned installers in src-tauri/target/release/bundle/
cd web
npm run tauri:build

# Open the produced .dmg / .msi / .AppImage / .deb and:
#   - install the app
#   - sign in (auth + first-run pull)
#   - create a task, see it land in Supabase
#   - sign out, sign in elsewhere, see the task
```

If that round-trip works locally, the CI build will work too — the difference between local and CI is just signing, not behavior.

---

## After the first release

- The **Classic Tauri customers** still need to be told the SaaS exists — they're on an unrelated build with a different bundle. Migration: email them the new download link + their grandfathered-Pro code (see SAAS_ROADMAP.md P6).
- Once a release ships, the in-app `<UpdateChecker />` banner picks up subsequent releases automatically. Users see "Update available · v0.x" → tap → app restarts on the new build.
- If you want a "beta" channel later, add a second endpoint URL (env-gated) and ship beta tags as `v*.*.*-beta.N`.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Workflow runs, build succeeds, but no install in app | Pubkey in `tauri.conf.json` doesn't match the private key used to sign. Regenerate, update conf, ship a new build. |
| macOS users still see Gatekeeper warning | Notarization didn't complete. Check the workflow log for `notarytool` output. |
| Windows users see SmartScreen | Reputation hasn't built yet, or cert is OV not EV. Both resolve with time + signed installs. |
| Bundle is huge | `sqlite3.wasm` is ~865KB even after compression — that's expected. Total bundle ~12MB compressed; ~30MB installed. |

---

## What this runbook deliberately doesn't cover

- Pushing updates to specific users only (cohort releases). Use channels for now.
- A/B-testing different bundle variants. Out of scope.
- App Store / Microsoft Store submission. Different code paths; not on the roadmap.
