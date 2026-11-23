#!/bin/bash
set -e

echo "=== 1. PULLING EXACT CI FAILURE LOG ==="
RUN_ID=$(gh run list --workflow="Android CI" --limit 1 --json databaseId --jq '.[0].databaseId')
gh run view "$RUN_ID" --log-failed | grep -E "FAIL |AssertionError|TypeError|Error:|TS[0-9]+:|##\[error\]" -A 3 | tail -n 40 > /tmp/ci-fail.txt || true

for phase in \
  "Read /tmp/ci-fail.txt and DIRECTIVE.md. Fix the exact failure that broke Android CI so pnpm check, pnpm run check:android-native-logs, and the affected Vitest suites pass with 0 errors, then commit." \
  "Read DIRECTIVE.md Sections 2, 3, and 4. Verify and complete: (1) Desktop Streamable HTTP MCP server/proxy on port 8080 with Bearer shared secret, (2) native stdio MCP transport (npx, uvx, docker) + shipped example mcpServers JSON (arcade-toolbox, smithery-toolbox, sympy, symbolica, wolfram, n8n, temporal), (3) mcp_registry_search (official MCP Registry + Arcade/Smithery), mcp_connect_remote (gated by Tool Broker), and async poll_workflow_status(workflow_id). Add/update unit tests and verify with pnpm check and vitest, then commit." \
  "Read DIRECTIVE.md Sections 4, 5, and 6. Wire the UI screens and settings: (1) Desktop Settings 'Desktop Brain Mode' toggle + copyable Tailscale connection string (http://<tailscale-ip>:8080/mcp + secret) + keep-awake guidance, (2) Android 'Connect to Desktop' screen (Tailscale IP + secret fields stored in Android Keystore) + smart routing (heavy tools -> desktop when paired, local tools + Root/Shizuku/Accessibility offline), (3) clear local-model fallback messages while preserving liquid-glass theme and Live2D/Agent Loop. Verify with pnpm check, then commit." \
  "Read DIRECTIVE.md Sections 7 and 8 and package.json. Confirm desktop target is Vite web (`pnpm build:web`), create `.github/workflows/desktop.yml` to typecheck, test, run `pnpm build:web`, and upload the Desktop web bundle artifact on push to main, and document both Android APK and Desktop build + pairing pipelines in `docs/BUILD_STRONGER.md`. Run `pnpm check && pnpm build:web && pnpm run check:android-native-logs` to verify 0 errors, then commit."
do
  echo "=========================================="
  echo "EXECUTING: $phase"
  echo "=========================================="
  aider \
    --edit-format diff \
    --model openrouter/deepseek/deepseek-chat \
    --yes-always \
    --no-detect-urls \
    --auto-test \
    --test-cmd "pnpm check && pnpm run check:android-native-logs && pnpm exec vitest run src/renderer/mobile/mcp-oauth-e2e.test.ts src/renderer/mobile/mcp-oauth-provider.test.ts src/renderer/mobile/mcp-remote-connection.test.ts src/renderer/desktop/mcp-proxy.test.ts" \
    --message "$phase" \
    DIRECTIVE.md package.json /tmp/ci-fail.txt
  git push
done
