# App-Link Association Ownership

Score Easy declares Android and iOS app links for `https://scoreeasy.app`.

Native declarations in this repo:
- Android package: `com.scoreeasy.app`
- iOS bundle identifier: `com.scoreeasy.app`
- Host: `scoreeasy.app`

Deployment-owned files that must be published at the site root before production app-link verification:
- `https://scoreeasy.app/.well-known/assetlinks.json`
- `https://scoreeasy.app/.well-known/apple-app-site-association`

The association files require release signing data that is not committed to the repository:
- Android SHA-256 certificate fingerprints for each release signing key.
- Apple Team ID for the App Store app identifier.

Do not commit placeholder fingerprints or Team IDs. Update the deployed association files from the release-signing source of truth, then verify Android `autoVerify` and iOS associated-domain resolution against `scoreeasy.app`.
