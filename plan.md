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
