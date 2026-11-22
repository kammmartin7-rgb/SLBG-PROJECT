# Build stronger-v0.0.27

Build the Android app from the repository root on the `main` branch. The project keeps Node, Java, Android SDK tools, Gradle caches, and downloads inside the workspace.

## Requirements

- Windows 10/11 with PowerShell (the checked-in bootstrap scripts use PowerShell)
- Android 11+ device or emulator
- Internet access, or a supported proxy configured with `YACHIYO_PROXY_URL`
- Accept Android SDK licenses yourself when prompted; the bootstrap script does not auto-accept them

## Setup and verify

```powershell
powershell -ExecutionPolicy Bypass -File scripts/bootstrap-toolchain.ps1
powershell -ExecutionPolicy Bypass -File scripts/yachiyo-env.ps1 pnpm install --frozen-lockfile
powershell -ExecutionPolicy Bypass -File scripts/yachiyo-env.ps1 pnpm check
powershell -ExecutionPolicy Bypass -File scripts/yachiyo-env.ps1 pnpm test
powershell -ExecutionPolicy Bypass -File scripts/yachiyo-env.ps1 pnpm lint
powershell -ExecutionPolicy Bypass -File scripts/yachiyo-env.ps1 pnpm run check:android-native-logs
```

## Build a debug APK

```powershell
powershell -ExecutionPolicy Bypass -File scripts/yachiyo-env.ps1 pnpm run mobile:sync:android
powershell -ExecutionPolicy Bypass -File scripts/yachiyo-env.ps1 gradle testDebugUnitTest --no-daemon --max-workers=1 --no-watch-fs
powershell -ExecutionPolicy Bypass -File scripts/yachiyo-env.ps1 gradle assembleDebug --no-daemon --max-workers=1 --no-watch-fs
```

The APK is written to:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

For device testing, install with `adb install -r` and launch `io.github.yachiyoclaw`. A successful host build does not by itself verify visual behavior, Live2D rendering, or device-specific local-model performance; check those on a device/emulator separately. See [BUILDING.md](BUILDING.md) for toolchain details and workspace policy.


## MCP transport design proposal

The first milestone targets the existing Android client. Keep one endpoint validator in front of OAuth discovery, token exchange and MCP requests. Use receiver-bound WebView fetch by default and allow tests to inject an in-memory transport. Require HTTPS for remote endpoints, including paired desktops. Keep access tokens and refresh tokens in the platform vault and omit request headers, bodies and callback query strings from diagnostics.

Prefer Streamable HTTP for new connections. Offer legacy SSE explicitly for compatible servers. Test discovery with a read-only tool before enabling a saved configuration. Apply bounded response sizes and timeouts. Retry discovery after transient disconnects. An interrupted tool call has an unknown outcome, so never replay it automatically.

Android should present remote connections and keep its device permissions behind the existing Tool Broker. Desktop process transport needs a separately packaged host and explicit user approval. Registry results and server-provided tool descriptions remain untrusted. Pairing, registry discovery, resumable jobs and NFC handoff are subsequent milestones. Acceptance starts with passing the OAuth suites and publishing a signed debug APK, followed by an Android device test.
