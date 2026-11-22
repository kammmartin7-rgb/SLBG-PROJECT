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

## macOS desktop preview

Build on macOS with Node 22, pnpm and the frozen project dependencies. Install the pinned packager outside the bundle, then build the renderer and native app.

```sh
npm install --prefix .tools/desktop @electron/packager@20.3.0
pnpm run build:web
bash scripts/package-macos.sh
```

Open the resulting application under `dist/desktop`. From Settings → MCP server, add a custom local server with the command `yachiyo-math`, leave arguments and environment empty, then click Test and Save. The packaged stdio service exposes `gcd`. For the remote example choose HTTP and enter `https://learn.microsoft.com/api/mcp` without credentials.

Run `node scripts/check-macos-mcp.mjs "/path/to/Yachiyo Claw.app"` to exercise packaged stdio and independently call Microsoft Learn through the SDK. The packaged Intel application passed discovery of gcd through its settings screen. Microsoft Learn returned search results in the SDK test. The settings screen's remote transport reported a network error in the test environment. This preview has an ad-hoc signature. Distribution with Apple notarization requires Developer ID signing credentials.

## Offline math on Android

Run the Alpine sandbox toolchain setup once while online. The installer adds the Alpine py3-sympy and py3-networkx packages and verifies that both libraries import before marking setup complete. Existing Alpine installations pick up the packages on their next toolchain setup. Once installed, operations such as symbolic factorization and shortest-path calculations run offline inside the sandbox.

## Local Ollama chat on Mac

Start Ollama on the same Mac and use its loopback address under Settings → Other APIs → Ollama. Fetch lists the installed models. Add the desired model and select it in the chat composer. The desktop package forwards model discovery and streamed text chat to the local Ollama API. This connection ignores the cloud compatibility proxy and strips tool definitions from text requests. Installing a model and running Ollama are prerequisites.

For qwen-local:latest text chat, the Mac build uses the local native Ollama chat endpoint with thinking disabled and a 15-minute keep-alive. It shortens the exact bundled persona in outgoing system messages, retaining other instructions and conversation history. The saved prompt is unchanged. Streamed content is forwarded to the chat composer as it arrives.
