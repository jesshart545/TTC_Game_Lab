# TTC AI: app-wide creation assistant

## Where it runs

The code ships with TTCGameLab's existing GitHub/Vercel application. The development conversation does not need to remain open. The model and media-generation services are separate dependencies; outages, invalid credentials, provider limits and hosting problems can make features unavailable. No promise of perpetual availability is implied.

Ask TTC AI replaces the previous floating Help & contact launcher. Creator pages provide help and navigation; an open editable project also supplies the real draft-execution adapter. Host dashboards offer help/private research navigation but do not gain draft-edit access. Audience overlays and nested guide frames exclude the assistant. Chat history is session memory, isolated per project/live workspace, and is lost on page reload. Messages go to the configured language-model service. Support context excludes full projects and private URLs; explicitly requested editing passes existing draft context to the editor service.

## Real operations

The existing validated draft executor is shared by editor chat and app-wide chat. It can edit supported project planning fields, overlay/tool appearance and placement, dashboard control connections, sequences and tool settings; create supported game tools, sourced trivia/list pools; request existing media generators; edit an image or animate a reference image; call the existing video-edit service; and render supported image-copy edits or browser video trims. Not every conceivable operation is supported. Broad compound creation can perform multiple draft changes, but generation actions produce one output per task; connecting that new output can require a follow-up after its saved identity exists.

Permanent image copies use the existing browser canvas and output PNG. Video trims require captureStream/MediaRecorder, an explicit Start video trim click for audible playback, and output WebM on supported browsers. Generative video edits can change content and are not exact timeline cuts. A task is not reported finished until its real output is stored/saved; failed saves are reported and browser draft work retained. Keep the project open during media tasks; this version has no durable background task recovery after browser closure. Original media and published snapshots are preserved. Undo restores the last AI draft snapshot and confirms its save; original storage objects are not deleted. Later manual edits invalidate that undo snapshot.

Publishing, deleting original data, resets and live playback remain manual controls. The assistant cannot arbitrarily patch app source code, deploy changes or alter accounts.

## Language-model configuration

Default: existing server-only AGNES_API_KEY and AGNES_MODEL, using Agnes's OpenAI-compatible endpoint. No hosting environment settings were changed by this feature.

Optional server-only overrides:

- TTC_AI_BASE_URL: HTTPS OpenAI-compatible base endpoint, including its API prefix (for example `/v1`). No credentials, query or fragment in this URL.
- TTC_AI_API_KEY: inference endpoint credential; if omitted the existing AGNES_API_KEY remains the fallback.
- TTC_AI_MODEL: served model name. Set this explicitly when changing the endpoint.

These configure both app-wide support routing and validated draft-edit language calls. A custom model must support chat completions and JSON-object responses reliably. Evaluate real tool schemas, IDs, structured clarification and unsupported-task behavior before production. Configuration does not train, download or deploy a model. Use a valid authenticated HTTPS gateway for self-hosting. Keep secrets out of browser code and Git.

Image/video/music/speech generator configurations are independent and unchanged. Switching the language model does not replace them or remove their provider dependencies. Model licenses, persistent inference hardware, monitoring and backups are separate deployment decisions.

## Validation

Mocked tests exercise support auth/rate limits/redaction, creator-only task routing, real UI-to-draft execution, connected scoreboard/background changes, structured follow-up, media result storage and permanent image-copy render flow, original preservation, compound layout+media changes, save/undo failures and project switching. The existing build and regression suite are retained. Mocked provider/media calls do not prove live provider availability or browser codec support; no paid generation tests were made.

## Requested execution versus suggestions

The assistant may suggest improvements and next steps, including readiness for publishing. Suggestions alone must not trigger draft edits, media generation, tool setup, automation, or publication. A user request to carry out a supported task is the execution instruction; do not impose extra approval dialogs on routine requested edits. Ask only for materially missing choices. Keep publishing and live-operation controls outside the assistant's draft executor.

The shared executor now receives an executable reference catalog distinguishing normal buttons from saved sequence IDs, validated background color samples when requested, strict action/reference checks, countdown renderer-field checks, and concrete draft change/sequence receipts. This is not a hardcoded timer-request workaround. Bad proposals are repaired or rejected before persistence; model replies are not evidence of execution. The configured model is now preferred before default fallback; no deployment environment values were changed.

Test status must distinguish mocked provider/executor tests from real-provider proposal tests and authenticated preview execution. A real production diagnostic reproduced the reported timer failure. Candidate instructions tested through the production text endpoint yielded valid new-scoreboard configuration and image-generation actions, but timer proposals still failed. This endpoint differs in temperature and output format from the draft endpoint, so those diagnostics do not establish readiness of the revised preview. No real media-generation test or live-game mutation was made during these diagnostics. Acceptance requires the actual preview draft route and resulting rehearsal behavior to pass before production promotion.
