# Streamlined workflow outcomes

- [x] The user can condense assets into collapsible folders with clear names and counts in the Asset Library and Workshop. Search and media filtering reveal matching folders, expand/collapse controls remain accessible, and browsing does not move, delete, duplicate, or modify stored files or asset-pool membership.
- [x] The user retains full control of all editing while the site becomes easier to navigate and understand. Scenes, tools/cards, pools, and optional Workshop settings are compact by default, with their existing editors and creation actions readily available when expanded.
- [x] Build Space background selection becomes easier to browse through labeled image, animated/video, and board groups and a focused search, without changing control wiring, media behavior, or the private-dashboard/audience-overlay relationship.
- [x] The changes are tested and offered in the existing GitHub/Vercel workflow. This change set is not merged into production until the owner approves it; no saved project or published overlay is reset or republished for testing.

## First-action guidance outcomes

- [x] Each section presents an obvious Start here first step with one primary button that opens or focuses the actual game-plan, background/board, or draft-rehearsal controls.
- [x] What next questions appear only after that first action is taken or meaningful existing work establishes that it was previously taken. Follow-up buttons open the appropriate existing controls; beginning a step must not claim it is finished or tested.
- [x] Users can revisit the first-step guide and navigate/edit freely. Preferences are per-project/per-stage and remain usable if browser storage is blocked. Preserve compact conversations, assets, pools, saved content, private links, published snapshots, and existing publishing safeguards.
- [x] The first-action update is tested and offered as a pull request/preview without publishing this new change set until the owner approves it.

## Dashboard Web Research outcomes

- [x] General web search is a prominent, always-accessible host dashboard tool, separate from YouTube search/playback. Hosts can search any topic without leaving the dashboard, with optional movie-quote, trivia/fact-check, and song/lyrics-reference shortcuts.
- [x] Hosts can read source excerpts and links, compare selected evidence, and request a sourced explanation that flags insufficient or conflicting support rather than declaring AI output verified. The tool uses actual authenticated search sources, distinguishes snippets from full-page reading, and retains source/usage-rights caveats.
- [x] Hosts can privately keep and edit useful findings in this browser while controlling the LIVE; notes are scoped to each live or draft workspace and remain usable if storage is blocked. Search, analysis, notes and opening/closing the panel never send content to the overlay, create cards/media, play a video, or update published snapshots. Preserve the explicit draft-only save-results-as-pool action and all existing controls.
- [x] The new workspace is tested and offered through the existing GitHub/Vercel preview workflow. Publish this new change set only after the owner approves production. Approved and verified live at production commit `72f258dd6a26b11abfa034e1587381adad563fea`.

## Contextual workflow clarity outcomes

- [x] One compact, section-specific task card replaces the overlapping first/next and mission banners. Section navigation comes before guidance, one action is visually primary, and alternate actions/help are disclosed rather than presented as three competing next steps.
- [x] Recommendations reflect the selected section and actual named game plan, saved media, enabled tools and compositions. Opening an input is not represented as completing a step; optional scenes are not forced between materials and assembly.
- [x] Game plan, Assets & tools, and Scenes & effects show their relevant work instead of the same mixed page. Editing state and all existing creation, upload, card, pool, board, media, AI, composition, Build Space, publishing and Web Research capabilities remain reachable.
- [x] The duplicated background shortcut and redundant linear navigation are removed without removing their underlying operations. Publishing remains an explicit user action in its review area. The correction is tested and offered in preview; no automatic production change or saved/live project reset. Owner-approved production deployment verified at `f985a731466f41c0c6b21db20d2b939cab264277`; the live workspace has one task card, one primary task action, section navigation before guidance, and no old mission banner or redundant linear navigation.

## Unified app-wide assistant outcomes

- [x] Users with different computer understanding can use one obvious app-wide Ask TTC AI conversation for explanations, troubleshooting, editor prompting, generation requests, and follow-up clarification. The assistant adapts to the user's level, asks only for genuinely missing details, and does not require users to find separate AI panels or choose a technical mode.
- [x] In an editable project, plain-language requested tasks execute through real app tools: incremental draft layout/control/tool edits, sourced trivia and list pools, supported image edits, image-to-video animation, video edits and supported media generation. Advice and navigation do not silently create or change content; generation is reported finished only after output is stored. Unsupported operations and provider failures are stated accurately rather than reported as success.
- [x] Current-page context and safe navigation open/focus the appropriate existing work area. The same chat reports task progress/results, supports follow-up requests, and offers existing draft undo where available. It preserves new/current draft content on failures, uses exact saved asset/tool identity, and does not overwrite or republish the live version.
- [x] The assistant is usable on small screens and keyboard, has an obvious close control and contact fallback, does not show in the audience overlay, and isolates conversations/in-flight work across projects. Private host keys, credentials, private URLs and full projects are absent from support prompts. Host-only access cannot execute draft edits, generation or live controls through the assistant.
- [ ] The feature is verified with mocked task execution and existing regression checks and offered in a GitHub/Vercel preview. No paid media-generation tests or production publication of this new feature without the owner's approval.
