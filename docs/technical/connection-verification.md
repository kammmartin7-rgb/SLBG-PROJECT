# Yachiyo Claw connection verification

## Results on November 26, 2026

- Full suite with a real Android SDK and live GitHub imports enabled: 2,259 passed, zero failed, 55 skipped. One of the skipped checks was the opt-in live Ollama test, which passed separately. TypeScript validation passed.
- The local Ollama instance listed qwen-local:latest. The first 90-second adapter generation timed out. A native Ollama call returned “peach” and the adapter retry returned the requested English text in an 18-second test.
- The packaged Mac executable ran its bundled math service and returned 6 for gcd(84, 30). A standard MCP client called the public Microsoft Learn endpoint and received a nonempty documentation result. These two live checks exercise the packaged child and the external service respectively. The independent attempt to launch an isolated packaged Electron window for a renderer-to-IPC run exited with SIGABRT before the renderer appeared. The packaged UI path remains unverified.
- The four desktop ADB handlers reached a mock bridge. Real Pixel verification was blocked because the test host prevented ADB from initializing its local state.
- The Settings export and restore buttons transferred a synthetic profile copy using a real JSON File and FileReader, and retained both source and destination agent IDs, MCP servers, active destination agent and destination API key.
- Paid accounts, live OAuth consent, real vendor credentials over SSE or Streamable HTTP, and live Android Ubuntu service results remain unverified. Some plugin titles and plugin-provided views still contain Chinese text.

## Agent tools

These names are conditional on the platform, enabled features, selected model, session permissions and active workspace. The three desktop browser names also exist on Android.

| Registration | Model-visible names |
|---|---|
| android-device | `android_app_list`, `android_click_node`, `android_companion_action`, `android_device_info`, `android_find_node`, `android_keyevent`, `android_launch_app`, `android_launcher_context`, `android_network_status`, `android_observe`, `android_permission_status`, `android_run_recipe`, `android_scroll_node`, `android_set_node_text`, `android_storage_status`, `android_swipe`, `android_tap`, `android_type_text` |
| coding | `coding_git_commit`, `coding_git_create_branch`, `coding_git_diff`, `coding_git_restore_files`, `coding_git_status`, `coding_propose_changes`, `coding_run_profile` |
| desktop-device | `adb_device_info`, `adb_devices`, `adb_tap`, `adb_ui_tree`, `browser_click`, `browser_navigate`, `browser_snapshot` |
| file | `read_file`, `search_file_content` |
| inter-agent | `get_session_status`, `list_sessions`, `send_to_session` |
| knowledge-base | `get_files_meta`, `list_files`, `query_knowledge_base`, `read_file_chunks` |
| long-term-memory | `forget_long_term_memory`, `remember_long_term_memory`, `search_long_term_memory` |
| sandbox | `sandbox_bash`, `sandbox_edit`, `sandbox_find`, `sandbox_grep`, `sandbox_job_output`, `sandbox_job_status`, `sandbox_ls`, `sandbox_read`, `sandbox_start_background`, `sandbox_stop_job`, `sandbox_write` |
| session-attachment-rag | `list_session_attachments`, `query_session_attachment`, `read_session_attachment_parents` |
| web-search | `parse_link`, `web_search` |
| workspace-agent | `workspace_apply_patch`, `workspace_git_status`, `workspace_plan`, `workspace_run_tests` |
| workspace-browser | `browser_click`, `browser_history`, `browser_navigate`, `browser_screenshot`, `browser_scroll`, `browser_select`, `browser_snapshot`, `browser_type`, `browser_wait`, `workspace_deploy`, `workspace_export_zip`, `workspace_external_status`, `workspace_preview`, `workspace_sync_from_external`, `workspace_sync_to_external` |
| Core, camera and skills | `agent_environment_status`, `agent_complete`, `agent_blocked`, `camera_capture`, `load_skill`, `execute_skill_script`, `write_skill` |

The desktop PC-control gateway exposes four ADB operations. Generic `adb_shell` and `adb_screenshot` are absent. Android browser and device mocks cannot establish Pixel connectivity. Mock execution covered the static chat tool names in the inventory, including both implementations of the three shared browser names. Broker IDs below have a separate authorization check. The GCD stdio service exposes `gcd`. External MCP servers supply a varying list at discovery time.

### Broker descriptors

The following IDs were resolved through the production authorization lookup. An authorization test exercises registration and backend policy. Native effects require a separate test.

`device.shell.exec`, `device.screen.observe`, `device.ui.find`, `device.ui.tap`, `device.ui.long_press`, `device.ui.swipe`, `device.ui.type_text`, `device.navigation.back`, `device.navigation.home`, `device.navigation.recents`, `device.app.list`, `device.app.launch`, `device.status.read`, `device.clipboard.read`, `device.clipboard.write`, `device.notification.list`, `device.quick_setting.set`, `device.file.read`, `device.file.write`, `agent.schedule.create`, `agent.schedule.list`, `agent.schedule.cancel`

`sandbox.command.exec`, `sandbox.command.start_background`, `sandbox.command.stop_background`, `sandbox.toolchain.install_android`, `skill.script.execute`, `plugin.sandbox.read`, `plugin.sandbox.write`, `plugin.sandbox.exec`, `plugin.network.fetch`, `plugin.ubuntu.install`, `plugin.ubuntu.remove`, `plugin.ubuntu.exec`, `plugin.ubuntu.read`, `plugin.ubuntu.write`, `plugin.ubuntu.stop`

Android companion descriptors are registered dynamically as `android.companion.<capability>`.

## Plugins and GitHub imports

| Package | UI handlers | Agent tools | Results |
|---|---|---|---|
| Error Help Center | render, search | None declared | Both handlers returned a view through the plugin runtime with a fixture host. |
| Hello Yachiyo | increment | hello-yachiyo_echo | Both handlers passed. Normal Agent chat displayed “The plugin echoed peach-42.” |
| Ubuntu Runtime | render, install, remove | ubuntu-runtime_status, exec, start_job, job_status, job_output, stop_job, read_file, write_file (all with the ubuntu-runtime_ prefix) | All 11 handlers passed with mocked Linux services. Normal Agent chat issued status and displayed “Ubuntu status could not be read on this platform.” The Linux service requires Android. |

Normal chat used the actual renderer, installer, worker, tool registry and message composer in a disposable browser profile. A deterministic model selected the tool and worded the reply from its result. Real cloud model behavior and Android Ubuntu execution remain unverified. The same Ubuntu package resolved from two repository URLs and one pinned package URL. Each distinct package was exercised in chat once.

Live importer inputs (the repeatable test is `src/renderer/plugins/github-import-live.test.ts`):

- https://github.com/kammmartin7-rgb/Yachiyo-claw-stronger — Ubuntu via repository.
- https://github.com/Wayne1145/yachiyo-claw — Ubuntu via repository.
- https://github.com/kammmartin7-rgb/Yachiyo-claw-stronger/blob/af449c3602647f7b7db1513296693a5bc7778641/plugin-marketplace/packages/hello-yachiyo-1.0.0.zip — bytes matched tracked ZIP, manifest verified.
- https://github.com/kammmartin7-rgb/Yachiyo-claw-stronger/blob/af449c3602647f7b7db1513296693a5bc7778641/plugin-marketplace/packages/ubuntu-runtime-1.0.0.zip — bytes matched tracked ZIP, manifest verified.
- https://github.com/jqlang/jq — downloaded an incompatible archive and rejected it.

Supported inputs include local package ZIPs, public HTTPS ZIP URLs, GitHub blob links and repository URLs. The repository resolver tries release assets, preferring yachiyo-plugin.zip, then a compatible catalog when a release asset is absent. Multiple catalog choices require choosing a package. The bundled official catalog lists Ubuntu. The verifier checks manifest and file integrity, and marketplace provenance/signature when required. Source repositories need a compatible package or catalog.

## Model providers

Every following provider completed a mock English text response via the production session model factory and chat adapter. Local inference used a fixture inference bridge. Cloud adapters used fixture HTTP responses.

`yachiyo`, `yachiyo-local`, `openai`, `openai-responses`, `gemini`, `claude`, `deepseek`, `qwen`, `qwen-portal`, `minimax`, `minimax-cn`, `moonshot`, `moonshot-cn`, `siliconflow`, `openrouter`, `ollama`, `lm-studio`, `azure`, `groq`, `xAI`, `mistral-ai`, `perplexity`, `volcengine`, `chatglm-6b`, `github-copilot`, `bedrock`, `vercel-ai-gateway`.

The four custom wire formats exercised in chat were OpenAI Chat Completions, OpenAI Responses, Anthropic Messages and Gemini. Seven Settings catalogs fetched fixture models: OpenAI, Claude, Gemini, DeepSeek, SiliconFlow, OpenRouter and Ollama. A real model account was not authenticated by these tests.

Provider credentials include API keys, local no-key endpoints, and AWS access key/secret, optional session token and region. The OAuth mapping includes Claude, Qwen Portal, MiniMax global/CN, OpenAI, OpenAI Responses (shared OpenAI credential), and GitHub Copilot. Mock chat with a fixture key does not test each provider’s interactive login.

The web_search entry and Tavily parse_link ran against fixture provider responses. Web search provider selections are Bing (also used for legacy built-in), optionally Bing News; Tavily, Bocha and Querit. Tavily also implements parse_link.

## MCP transports and configuration

| Path | Verification |
|---|---|
| Desktop stdio | Packaged math entry discovered and returned gcd(84,30) = 6. The Mac bridge permits the bundled math service. Arbitrary stdio commands are unsupported there. |
| Microsoft Learn, anonymous Streamable HTTP | Live SDK discovery and microsoft_docs_search returned text. |
| SSE and Streamable HTTP | Production MCPServer initialized, listed and called echo with a checked Bearer header over mocked fetch. |
| Five bundled remote presets | Fetch, Sequential Thinking, EdgeOne Pages, arXiv and Context7 each initialized, discovered and called echo on a mock endpoint checking the x-chatbox-license header. Real vendor tool catalogs and accounts remain unverified. |
| MCP OAuth | Existing mock PKCE/credential lifecycle coverage. Desktop OAuth without a provider produced a credential error before network access. A live desktop consent/refresh round trip is blocked by the missing desktop credential provider. |
| Configuration | Settings form, single-server JSON and mcpServers map; stdio command/args/env, HTTP URL/protocol, named headers, secure-store references, OAuth metadata/redirect/scopes. JSON is a configuration representation. SSE and Streamable HTTP are transports. Secure-reference kinds are header, api-key, oauth-access-token, oauth-refresh-token. |

### Discoverable stdio catalog

The picker also ships 41 command templates. Every template was parsed and handed to the connection controller with the desktop bridge present. Each failed to start because this build admits only its bundled math stdio service. The tests assert the actionable error and that no process starts. This is a desktop capability limitation.

`brave-search`, `chroma`, `context-7`, `git`, `github`, `gitlab`, `e2b`, `exa`, `google-drive`, `jetbrains`, `heroku`, `filesystem`, `paddle`, `perplexity`, `sentry`, `slack`, `square`, `stripe`, `supabase`, `tavily`, `xero`, `firecrawl`, `playwright`, `notion`, `pydantic-run-python`, `pydantic-logfire`, `polar`, `elevenlabs`, `talk-to-figma`, `airbnb`, `airtable`, `apple-script`, `basic-memory`, `big-query`, `clickup`, `discord`, `firebase`, `ghost`, `iterm`, `lightdash`, `monday`.

### Stdio templates in the Settings catalog

All 41 templates parsed. Each attempted start on the standalone desktop path reached the unsupported-command error. That is a verified host limitation. These entries describe third-party processes and do not ship those services in the Mac application.

`brave-search`, `chroma`, `context-7`, `git`, `github`, `gitlab`, `e2b`, `exa`, `google-drive`, `jetbrains`, `heroku`, `filesystem`, `paddle`, `perplexity`, `sentry`, `slack`, `square`, `stripe`, `supabase`, `tavily`, `xero`, `firecrawl`, `playwright`, `notion`, `pydantic-run-python`, `pydantic-logfire`, `polar`, `elevenlabs`, `talk-to-figma`, `airbnb`, `airtable`, `apple-script`, `basic-memory`, `big-query`, `clickup`, `discord`, `firebase`, `ghost`, `iterm`, `lightdash`, `monday`.

## Migration and release scope

Disposable browser/desktop state fixtures exercised importing twice, retaining target agent selection, same-ID agents and MCP connections, and an existing provider key omitted from the incoming settings. Agent profiles are now included under __agent_profiles when copilots are exported. Backups written before this field existed cannot restore an omitted profile. Secure vault values and plugin grants are separate from exported server definitions. No automatic transfer between browser and Electron origins was established.

The downloadable Intel Mac v0.0.28 predates the common Agent plugin initialization, web product version, additive profile migration and Bedrock streaming fixes. That release has a different source tree. An ad-hoc-signed desktop install can offer a release download; transparent replacement requires the supported Developer ID update path.

## Reproduction

Run Vitest from the repository root with Node 22. Set ANDROID_SDK_ROOT to an SDK containing aapt, aapt2 and android.jar. Set YACHIYO_LIVE_IMPORTS=1 to enable the five public GitHub cases. Run scripts/check-macos-mcp.mjs with a packaged .app path to exercise the packaged math executable and public Microsoft Learn endpoint.
