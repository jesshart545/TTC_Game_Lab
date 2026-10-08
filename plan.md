# Streamlined asset organization

## Goal and scope
Keep the current Vercel/GitHub application and its Workshop → Build Space → Publish workflow. Reduce long pages through collapsible folders and sections without removing editing capabilities or changing saved assets, game pools, live overlay behavior, permissions, or media generation.

The Asset Library will group assets by their existing project and then by Images, Videos, Audio, and Other files. Workshop media uses the same category folders. Each folder shows a count, opens with an accessible keyboard-friendly control, and can be expanded or collapsed individually or together. Search and media filtering reveal matching folders rather than leaving results hidden. Browser-session preferences remember manually opened folders when available; disabled storage must not break browsing. These are display folders, not physical moves or new asset metadata.

Workshop's long scenes/compositions, game tools/cards, asset pools, sharing, and optional settings sections will use progressive disclosure. Individual tools can be opened on demand with their existing custom editors intact. Creation buttons, the selected-asset dialog, media editors, and the scene composer remain reachable. Sidebar/editor state should not be discarded simply by collapsing a settings section. Build Space background choices will be grouped into image, animated/video, and board folders with a compact search, while preserving all current selection and dashboard wiring behavior.

## Design
Retain the dark cyan/purple creative-studio identity. Folder rows are compact, readable 44px controls with a folder outline, chevron, title, and count. Cyan identifies an expanded folder; muted supporting copy explains what is inside. Use existing typography, no decorative assets, and no changes to the audience overlay's animation. Nested sections are visually inset but remain usable on phone-width screens. The interface progressively reveals detail rather than introducing another wizard or gating stages.

## Structure
`components/CollapsibleFolder.tsx` provides the shared accessible folder control. `components/AssetFolders.tsx` and `lib/asset-folders.ts` provide stable media grouping that keeps original asset references and indices. `app/folders.css`, imported by the existing root layout, supplies scoped responsive folder styles. The existing Asset Library page, project workspace, and Build Space component adopt these helpers. Tests cover collapse/search/selection, preserved asset identity, folder preferences, and retained edit/copy actions.

## Delivery
Implement on `feat/collapsible-asset-folders`, run existing and targeted regression checks, build locally with compile-only auth placeholders, and open a pull request/preview for review. Production publication is a separate step requiring approval of this new change set; the earlier approval covered the already-deployed navigation cleanup.

## First-action guidance refinement

The next usability change must make an obvious first step visible before any “What next?” questions appear. Add a prominent Start here card for Workshop (describe the game), Build Space (choose a background/board, or open Workshop to create one), and Publish (open draft rehearsal/review). Its button must open/focus the real existing work area, not merely display an instruction. Only after that action is taken—or meaningful existing project work shows that the entry action has already happened—reveal a small contextual What next question with working action buttons. Starting an action is not presented as completing or verifying the game.

The guide tracks only browser-session display preferences, separately for each project and stage. It must not add server schema, mark a draft tested, publish anything, lock the stage navigation, hide editing tools, lose the owner's new compact AI conversation layout, or overwrite existing project content. A Show first step action allows replay. Existing navigation remains available at all times; the old Next controls/mission details are visually deferred until entry, rather than creating another mandatory wizard.

Implement `components/WorkflowEntryGuide.tsx` for consistent first/next card rendering and `lib/first-step-guidance.ts` for safe session preferences and existing-work detection. The project workspace supplies actual actions. Build Space accepts a sequenced entry request to open/focus Background, Add items, or Test without firing runtime controls. Use the existing TypeScript check because the Webdev diagnostic endpoint reports no active managed project; do not initialize a replacement site. Deliver via a GitHub pull request/Vercel preview on `feat/first-step-guidance`; this new change set is not authorized for production until separately approved.
