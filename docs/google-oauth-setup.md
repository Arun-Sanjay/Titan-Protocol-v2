# Google OAuth setup (Phase 7.3)

The login screen ships with Google sign-in code wired but feature-flagged on
two `.env` variables. The button is hidden when either is missing, so the
build is safe to ship before you complete this checklist.

## What you need to do

### 1. Get the SHA-1 fingerprint of `titan-release.jks`

The Android client ID in Google Cloud Console must be tied to the SHA-1
of the keystore that signs your APKs. The Play Store signing keystore is
`titan-release.jks` at the repo root.

```bash
keytool -list -v \
  -keystore titan-release.jks \
  -alias <your-alias>
```

Look for the line `SHA1: AB:CD:EF:...`. Copy that.

If you don't remember the keystore alias, list them:

```bash
keytool -list -keystore titan-release.jks
```

### 2. Create OAuth credentials in Google Cloud Console

Open <https://console.cloud.google.com/apis/credentials> and select (or
create) a project for Titan Protocol.

1. **Web client ID** (Supabase needs this for the server-side exchange):
   - Click *Create credentials → OAuth client ID*
   - Application type: **Web application**
   - Name: `Titan Protocol Web Client`
   - Authorized redirect URIs: leave empty for now (Supabase fills this in)
   - Click *Create* and copy the **client ID** AND **client secret**

2. **Android client ID** (the app uses this directly):
   - Click *Create credentials → OAuth client ID*
   - Application type: **Android**
   - Name: `Titan Protocol Android`
   - Package name: `com.titan.protocol`
   - SHA-1 certificate fingerprint: paste the SHA-1 from step 1
   - Click *Create* and copy the **client ID**

### 3. Configure Supabase Auth

Open the Supabase dashboard for project `rmvodrpgaffxeultskst`:

1. Authentication → Providers → Google → Enable
2. Paste the **Web client ID** and **client secret** from step 2.1
3. Save

### 4. Populate `.env`

Add these to `titan-protocol/.env`:

```bash
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<the web client ID from step 2.1>
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=<the android client ID from step 2.2>
```

### 5. Rebuild

The Google sign-in button on `app/(auth)/login.tsx` will appear automatically
on the next bundle reload. Trigger a Metro restart to pick up the new env
vars:

```bash
npm run start -- --clear
```

## Testing

- Tap "Continue with Google" on the login screen
- Complete the Google consent screen in the in-app browser
- The browser auto-closes and you land back in the app authenticated
- Your Supabase profile row should have the email field populated from
  the Google account

## Failure modes

- **"Google did not return an ID token"** — the OAuth client is missing the
  *id_token* response type. Re-create it with the default response types.
- **"Could not exchange Google credentials"** — the web client secret in
  Supabase doesn't match the one Google generated. Re-paste it.
- **Dialog opens then immediately closes** — the SHA-1 in the Android client
  doesn't match `titan-release.jks`. Re-derive the SHA-1 with `keytool` and
  update the OAuth client.
- **App boots but the button is missing** — env vars are empty. Check
  `.env` and restart Metro.
