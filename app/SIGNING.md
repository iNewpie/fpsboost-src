# Making FPS Boost trusted by Windows

Two different Windows screens, two different causes:

| Screen | Cause | Fix |
|---|---|---|
| **"Windows protected your PC — Unknown publisher"** (SmartScreen, on the installer) | The installer carries no Authenticode signature, so Windows has no publisher identity to build reputation on. Every new unsigned build starts from zero. | Sign every build with a code-signing certificate (below). With an **OV** certificate reputation builds over a few hundred clean installs; with **EV** or **Azure Trusted Signing** it is trusted from day one. |
| **"Operation did not complete successfully because the file contains a virus or potentially unwanted software"** (Defender, on `fpsboost.exe`) | A Defender detection — almost always the machine-learning heuristics that hit unsigned Go executables (`Trojan:Win32/Wacatac.B!ml`, `Program:Win32/Wacapew.C!ml`) or the PUA class for "system optimizers". | Report the false positive to Microsoft (below); signing removes most of these detections too, because signed files from a known publisher are scored very differently. |

## 1. Get a certificate (one of these)

The build already signs everything when credentials exist (`scripts/sign.sh`, `.sign.env`): the exe, the installer and
the uninstaller, SHA-256 with an RFC 3161 timestamp. Nothing else in the pipeline changes.

1. **Azure Trusted Signing** (Microsoft) — ~US$10/month, certificates issued by Microsoft, immediate SmartScreen
   trust. Needs an Azure subscription and identity validation (an individual with a government ID, or an organisation
   with a verifiable legal record; Iran is not in the supported list, so this needs an entity or a person in a supported
   country). Sign from this Linux box with `jsign` (installed in `/root/tools/jsign.jar`):
   `SIGN_JSIGN="--storetype TRUSTEDSIGNING --keystore weu.codesigning.azure.net --storepass <tenant>|<client-id>|<client-secret> --alias <account>/<profile>"`
2. **SSL.com OV code signing + eSigner cloud** — ~US$200/year, identity validation by document + video call, no USB token
   needed; signing from Linux with jsign (`--storetype ESIGNER`). Works for individuals.
3. **Certum "Standard Code Signing in the Cloud" (SimplySign)** — ~€70/year, the cheapest OV route; individual or company,
   passport + proof of address. Signs from Linux through the SimplySign PKCS#11 driver (`--storetype PKCS11`).
4. **Sectigo / DigiCert OV certificate on a USB token or .pfx** — the classic route (US$250–600/year, EV even more);
   a `.pfx` goes straight into `SIGN_PFX` / `SIGN_PASS`.

Whatever the choice, the certificate's subject (the publisher name Windows shows) should be the name people see on
fpsboost.ir, so the two match.

Then: `bash scripts/build.sh && bash scripts/release.sh && bash ../server/deploy.sh` — the build prints
`== FPS Boost x.y.z (signed)` and `signed dist/…` for each file.

## 2. Report the Defender false positive (free, takes minutes, works even before a certificate)

1. Go to <https://www.microsoft.com/wdsi/filesubmission> and sign in with any Microsoft account.
2. Choose **Software developer**, upload **both** `dist/fpsboost.exe` and `dist/FPSBoost-Setup.exe` (one submission each
   or a zip), pick "Incorrectly detected as malware/malicious".
3. In the notes paste something like:
   > FPS Boost (https://fpsboost.ir) is a commercial Windows gaming optimizer: a Go + WebView2 desktop app that applies
   > documented registry/power/network tweaks with a one-click undo (every original value is backed up), and a
   > background "Guard" that raises a game's priority and trims other processes' working sets. It runs as administrator
   > by design (manifest), creates a logon task for its tray mode, and talks only to https://fpsboost.ir for licensing.
   > Source of the detected build: GitHub release https://github.com/iNewpie/fpsboost/releases. SHA-256 of the files:
   > (paste the hashes printed by `sha256sum dist/*.exe`).
4. Microsoft usually answers within 24–72 h and pushes a definition update; the fix is per file hash, so repeat it for
   each release until the builds are signed.

Also worth doing once: a VirusTotal scan of each release (<https://www.virustotal.com>) shows exactly which engines
flag the file and under which name — that tells us whether a build change helped.

## 3. What the build does to stay off the heuristics' radar

- Version info and a proper application manifest (company, product, description) — present since 1.0.
- PowerShell is invoked without `-ExecutionPolicy Bypass` (1.0.3+): the flag is unnecessary for `-Command` and is one of
  the most heavily weighted "suspicious" strings.
- The exe keeps its symbol table (`-ldflags -w`, not `-s -w`) from 1.0.3+: fully stripped Go binaries score worse in
  Defender's ML models; the cost is ~2 MB.
- No packer, no obfuscation, no self-extraction tricks: the installer is plain NSIS with the Microsoft-signed WebView2
  bootstrapper inside, exactly as thousands of apps ship it.

## 4. Until the certificate arrives

The site's FAQ already explains the SmartScreen screen (More info → Run anyway). Keep the download on GitHub Releases
(SmartScreen gives downloads from well-known hosts a slightly better score than from unknown domains) and keep the
Defender submission up to date for each release.
