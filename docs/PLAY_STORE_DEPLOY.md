# Google Play Store Auto-Deploy

Manual-triggered GitHub Actions workflow that builds a signed Android App
Bundle (`.aab`) and uploads it to the Play Store. Trigger from
**Actions → Deploy to Google Play Store → Run workflow** in this repo.

## One-time setup (do once per project)

### 1. Generate the upload keystore

This is your app's permanent identity on the Play Store — **lose it and
you can never publish updates for this app again**. Back it up somewhere
safe (1Password, BitWarden, a printed copy in a safe).

```bash
keytool -genkey -v -keystore upload-keystore.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias upload
```

Remember the passwords and the alias you typed — you'll need them as
GitHub secrets.

### 2. Base64-encode the keystore

Workflow injects it into the runner as a binary blob.

**Windows (PowerShell):**
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("upload-keystore.jks")) `
  | Out-File -Encoding ASCII keystore.b64
```

**Linux/macOS:**
```bash
base64 -w 0 upload-keystore.jks > keystore.b64
```

### 3. First Play Store upload — must be manual

Google Play won't accept API uploads for a brand-new app. Do these in
the Play Console once:

1. Create the app entry (App name, language, default language, Free / Paid).
2. Fill out all required **App content** sections (privacy policy URL,
   target audience, data safety, etc.) — Play won't promote to
   production until they're complete; internal track is more forgiving.
3. Build a signed AAB locally (see "Local release build" below) and
   upload it through the Play Console UI to the **Internal testing**
   track. This proves to Google that you control the signing key.

After that the API can take over.

### 4. Create the Play Store service account

The GitHub Actions workflow needs API access.

1. **Google Cloud Console** → select (or create) the project linked to
   your Play Store account → **APIs & Services → Library** → enable
   **"Google Play Android Developer API"**.
2. **IAM & Admin → Service Accounts** → **Create service account**:
   - Name: `play-store-uploader` (any name works)
   - Skip the optional role-grant step at the Cloud level
   - Click the service account → **Keys** → **Add key** → **JSON** →
     download the JSON file (save it offline, you'll paste its full
     contents into a GitHub secret in step 5).
3. **Play Console** → **Settings → API access** → find the new service
   account → **Grant access** → give it the **Release manager** role,
   limited to this app. Approve.

### 5. Add GitHub secrets

In the `mobile-app` GitHub repo: **Settings → Secrets and variables →
Actions → New repository secret**. Add five secrets:

| Name | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | Contents of `keystore.b64` from step 2 |
| `ANDROID_KEYSTORE_PASSWORD` | The store password you typed in `keytool` |
| `ANDROID_KEY_ALIAS` | The alias you typed in `keytool` (e.g. `upload`) |
| `ANDROID_KEY_PASSWORD` | The key password (same as store password if you pressed Enter at the prompt) |
| `PLAY_STORE_SERVICE_ACCOUNT_JSON` | Full JSON contents of the service-account key from step 4 |

## Triggering a release

1. Push your changes to `main` (or any branch — the workflow checks out
   the branch you pick).
2. **Actions** tab → **Deploy to Google Play Store** → **Run workflow**:
   - **Branch**: usually `main`
   - **Track**: `internal` (testers only) / `alpha` / `beta` / `production`
   - **Version name**: user-visible string, e.g. `1.0.5`
   - **Release notes**: short description (max 500 chars, en-US)
   - **Rollout**: `1.0` for full rollout, `0.1` for 10 % staged, etc.
3. Click **Run workflow**. Build takes 5–15 min on a free runner.
4. When green, check Play Console → your app → the chosen track. The
   new version appears within a minute, with the `versionCode` shown
   in the workflow's job summary.

## How the versionCode is bumped

Play Store rejects duplicate `versionCode`s. The workflow sets:

```
versionCode = 100 + GITHUB_RUN_NUMBER
```

So every workflow run gets a unique, monotonically-growing number
(starting from `101` for the first run). The committed default in
`android/app/build.gradle` stays at `18` — that's only used for local
debug builds and the bump is done in-runner via `sed`.

If you ever cross the `999` mark on `GITHUB_RUN_NUMBER`, bump the
`100` offset in the workflow to `1000` or higher.

## Local release build (for smoke-testing what Play will sign)

Set the signing env vars in your shell and run gradle:

```bash
export ANDROID_KEYSTORE_PATH="$PWD/android/app/keystore/upload-keystore.jks"
export ANDROID_KEYSTORE_PASSWORD="..."
export ANDROID_KEY_ALIAS="upload"
export ANDROID_KEY_PASSWORD="..."

cd mobile-app
npm run build -- --configuration production
npx cap sync android
cd android
./gradlew bundleRelease
ls -lh app/build/outputs/bundle/release/
```

Without the env vars, `bundleRelease` still works — it just falls back
to the debug signing key and Play Store would reject the upload. So
local builds without env vars are fine for verifying the build chain
but useless for actual publishing.

## Troubleshooting

**`The Android App Bundle was not signed.`**
You didn't set `ANDROID_KEYSTORE_PATH` (or the path was empty / file
missing). Re-check the secrets and the decode step in the workflow log.

**`Version code X has already been used.`**
You ran the same workflow twice with the same `GITHUB_RUN_NUMBER` after
manually editing `build.gradle`. The next run will use the next
`run_number` automatically — usually just re-run.

**`googleApi failed with status code 403: The caller does not have permission.`**
The service account isn't granted on the Play Console (step 4.3) or
the API isn't enabled on the Cloud project (step 4.1).

**`Package not found: app.scheday`**
You haven't done step 3 — the very first upload must go through the
Play Console UI, not the API.

**Want to roll out gradually?**
Run with `rollout_percentage=0.1` (10 %) for the first day, then
re-run with `1.0` once you're confident — Play Store accepts a
no-new-AAB rollout-increase request, but the simplest UX is just to
re-run the workflow with the same version and a higher fraction.
