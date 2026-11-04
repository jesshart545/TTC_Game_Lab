"use client";
import "./stage-review.css";
import BuildOverlayPreview from "./BuildOverlayPreview";
import JewelWandScene from "./JewelWandScene";
import FontPicker from './FontPicker';
import CountdownDuration from "./CountdownDuration";
import { useState, useEffect, useLayoutEffect, useRef, useMemo, type ReactNode, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import type { Project, ProjectEvent, ProjectAsset, GameTool, OverlayResult } from "../lib/project";
import { titleFromToolSave } from "../lib/project";
import { controlLabel, controlButtonStyle, infoTypes } from "../lib/game-tools";
import type { CardState } from "../lib/question-cards";
import type { YouTubeState } from "../lib/youtube";
import { safeYoutubePlacement } from "../lib/youtube";
import { defaultOverlayResult } from "./CompositionPlayer";
import WheelHostPanel from "./WheelHostPanel";
import QuestionCardEditor from "./QuestionCardEditor";
import GameToolEditor from "./GameToolEditor";
import { buttonFacts, controlEffectResult, stageFitWidth } from "../lib/build-controls";
import { mediaKind } from "../lib/board-design";
import { normalizePlacement, movePlacement, resizePlacement, toolShapePlacement } from '../lib/overlay-placement';
import { ControlAppearancePreview } from "./RuntimeActionLayers";
import YouTubePlacementEditor from "./YouTubePlacementEditor";
import YouTubeHostPanel from "./YouTubeHostPanel";
import { reorderVisibleControls } from "../lib/stage-review";

/**
 * Set the Stage — the review spaces (Jessica, 2026-11-04).
 *
 * For gameshow and talk projects, the staging area shows ONLY three
 * things: Jewel's conversation (entered through the wand scene, the
 * stage-0 way) at the top, and — immediately past her, in ONE spot —
 * the overlay review and the dashboard review on a toggle. Only one
 * review shows at a time, in that one place; nobody scrolls past
 * anything else to find either of them. The reviews are not
 * mock-ups: the overlay review renders the same draft overlay node
 * the published overlay runs, and the dashboard review's buttons
 * fire through the same runtime the published dashboard uses — once
 * a button is wired, pressing it here does exactly what it will do
 * live, and flipping to the Overlay side shows the result. There is
 * no separate Test mode.
 *
 * Adding, staging and wiring happen through Jewel (her connections
 * and build changes); what the creator does by hand here is what the
 * review itself invites: drag placed items across the overlay review
 * (persisted through the placement model — asset edits.placement,
 * tool config.placement, control overlayResult), drag dashboard
 * buttons to reorder them (persisted as control order), and edit any
 * item in place through the same inspectors the old Build Space used
 * — minus the manual wiring editors, which are Jewel's job now.
 *
 * Legacy projects (older field shapes, default-era controls whose
 * actions the current runtime only flashes for) render exactly as
 * they do in the published surfaces: every control stays on the
 * dashboard, every placed item stays on the overlay, and nothing is
 * stripped, hidden or "fixed" by opening the project here. All saves
 * spread the existing project object, so fields this surface does
 * not know about pass through untouched.
 */

type Placement = { x: number; y: number; width: number; height: number };

/** A drag frame over one placed overlay item: drag the body to move
 *  it, drag ↘ (or use the arrow keys) to resize. A press that does
 *  not move selects the item instead — the same pointer contract as
 *  the placement editor the product already uses, minus its size
 *  panel, so every placed item can be grabbed directly. Movement
 *  past a small threshold is a drag; anything less is a click. */
function StageDragBox({ label, placement, canvasRef, selected, onSelect, onCommit }: {
  label: string;
  placement: Placement;
  canvasRef: RefObject<HTMLElement | null>;
  selected?: boolean;
  onSelect: () => void;
  onCommit: (placement: Placement) => void;
}) {
  const [draft, setDraft] = useState<Placement | null>(null);
  const drag = useRef<{ x: number; y: number; w: number; h: number; start: Placement; resize: boolean; moved: boolean } | null>(null);
  const pending = useRef<Placement | null>(null);
  const value = draft || placement;
  function start(event: ReactPointerEvent<HTMLButtonElement>, resize: boolean) {
    const canvas = canvasRef.current?.getBoundingClientRect();
    if (!canvas || !canvas.width || !canvas.height) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    pending.current = null;
    drag.current = { x: event.clientX, y: event.clientY, w: canvas.width, h: canvas.height, start: normalizePlacement(placement), resize, moved: false };
  }
  function move(event: ReactPointerEvent<HTMLButtonElement>) {
    const current = drag.current; if (!current) return;
    const dx = (event.clientX - current.x) / current.w * 100, dy = (event.clientY - current.y) / current.h * 100;
    if (Math.abs(event.clientX - current.x) + Math.abs(event.clientY - current.y) > 4) current.moved = true;
    if (!current.moved) return;
    const next = normalizePlacement(current.resize ? resizePlacement(current.start, dx, dy) : movePlacement(current.start, dx, dy));
    pending.current = next; setDraft(next);
  }
  function finish() {
    const current = drag.current; drag.current = null;
    const next = pending.current; pending.current = null;
    setDraft(null);
    if (!current) return;
    if (current.moved && next) { onCommit(next); onSelect(); }
    else if (!current.resize) onSelect();
  }
  function cancel() { drag.current = null; pending.current = null; setDraft(null); }
  function keys(resize: boolean) {
    return (event: React.KeyboardEvent<HTMLButtonElement>) => {
      const delta = event.shiftKey ? 5 : 1;
      const base = normalizePlacement(placement);
      const changes: Record<string, Placement> = resize
        ? { ArrowLeft: { ...base, width: base.width - delta }, ArrowRight: { ...base, width: base.width + delta }, ArrowUp: { ...base, height: base.height - delta }, ArrowDown: { ...base, height: base.height + delta } }
        : { ArrowLeft: { ...base, x: base.x - delta }, ArrowRight: { ...base, x: base.x + delta }, ArrowUp: { ...base, y: base.y - delta }, ArrowDown: { ...base, y: base.y + delta } };
      if (changes[event.key]) { event.preventDefault(); onCommit(normalizePlacement(changes[event.key])); onSelect(); }
    };
  }
  return (
    <div className={"sr-dragbox" + (selected ? " selected" : "")} style={{ left: value.x + "%", top: value.y + "%", width: value.width + "%", height: value.height + "%" }}>
      <button type="button" className="sr-dragbox-move" aria-label={`Move ${label}`} aria-pressed={selected}
        onPointerDown={e => start(e, false)} onPointerMove={move} onPointerUp={finish} onPointerCancel={cancel} onKeyDown={keys(false)}>
        <span>{label} · drag to move</span>
      </button>
      <button type="button" className="sr-dragbox-resize" aria-label={`Resize ${label}`}
        onPointerDown={e => start(e, true)} onPointerMove={move} onPointerUp={finish} onPointerCancel={cancel} onKeyDown={keys(true)}>↘</button>
    </div>
  );
}

type Props = {
  jewelPanel: ReactNode;
  onEnterJewel: () => void;
  sequenceRunning: boolean;
  sequenceError: string;
  onStopSequence: () => void;
  onResetGame?: (wipeEdits: boolean) => void;
  cardStates: Record<string, CardState>;
  onSelect: (selection: { kind: string; id: string } | null) => void;
  focusControl?: { id: string; request: number } | null;
  project: Project;
  onChange: (project: Project) => void;
  overlay: ReactNode;
  onTrigger: (control: ProjectEvent) => void;
  onWorkshop: () => void;
  youtubeOpen: boolean;
  onOpenYoutube: () => void;
  onCloseYoutube: () => void;
  onYoutubeCommand: (command: Record<string, unknown>) => Promise<YouTubeState>;
  youtubeState: YouTubeState | null;
  youtubeFeedback: { playbackId: string; status: string; errorCode?: number } | null;
  dashboardExtras?: (toolId?: string) => ReactNode;
  feedback?: string;
  ccssEntitled?: boolean;
};

export default function StageReview({ jewelPanel, onEnterJewel, sequenceRunning, sequenceError, onStopSequence, onResetGame, cardStates, onSelect, focusControl, project, onChange, overlay, onTrigger, onWorkshop, youtubeOpen, onOpenYoutube, onCloseYoutube, onYoutubeCommand, youtubeState, youtubeFeedback, dashboardExtras, feedback, ccssEntitled = false }: Props) {
  const currentProject = useRef(project); currentProject.current = project;
  const save = (next: Project) => { currentProject.current = next; onChange(next); };
  // The two reviews share ONE spot, on a toggle (Jessica's
  // correction, 2026-11-04): only the chosen side renders, in the
  // same place, immediately past Jewel. The runtime behind both
  // sides is the page's shared draft runtime, so a dashboard press
  // lands on the overlay whether or not the Overlay side is the one
  // showing — flip the toggle to see it.
  const [reviewSide, setReviewSide] = useState<"overlay" | "dashboard">("overlay");
  // The global Ask Jewel launcher (the root layout's support bubble)
  // is a second Jewel door floating at the bottom of the page. This
  // page already IS Jewel's conversation, so the launcher leaves
  // while the review surface is mounted.
  useEffect(() => {
    const body = window.document?.body; if (!body) return;
    const previous = body.dataset.stageReview;
    body.dataset.stageReview = "true";
    return () => {
      if (previous === undefined) delete body.dataset.stageReview;
      else body.dataset.stageReview = previous;
    };
  }, []);
  const [selection, setSelection] = useState<{ kind: "asset" | "tool" | "control"; id: string } | null>(null);
  useEffect(() => onSelect(selection), [selection, onSelect]);
  useEffect(() => {
    if (!selection) return;
    const exists = selection.kind === 'control' ? (project.controls || []).some(c => c.id === selection.id)
      : selection.kind === 'tool' ? (project.gameTools || []).some(t => t.id === selection.id)
      : (project.assets || []).some(a => (a.storageKey || a.name) === selection.id);
    if (!exists) setSelection(null);
  }, [selection, project.controls, project.gameTools, project.assets]);
  useEffect(() => { if (focusControl) setSelection({ kind: 'control', id: focusControl.id }); }, [focusControl]);
  const settings = useRef<HTMLElement>(null);
  useEffect(() => { if (selection) settings.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [selection]);
  const [positionYoutube, setPositionYoutube] = useState(false);
  useEffect(() => setPositionYoutube(false), [selection?.id]);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [resetWipe, setResetWipe] = useState(true);

  // Measured stage fit, the same helper and contract Build Space uses:
  // the widest 16:9 frame that still fits inside the review canvas.
  const overlayCanvasRef = useRef<HTMLElement>(null);
  const stageFrameRef = useRef<HTMLDivElement>(null);
  const [fittedStageWidth, setFittedStageWidth] = useState<number | null>(null);
  const placedFitCount = (project.assets || []).filter(a => a.inProject).length + (project.gameTools || []).filter(t => t.inOverlayBuild).length;
  useLayoutEffect(() => {
    const canvas = overlayCanvasRef.current; if (!canvas) return;
    const view = canvas.ownerDocument.defaultView; if (!view) return;
    const measure = () => {
      if (!canvas.clientWidth || !canvas.clientHeight) return;
      if (!view.matchMedia?.('(min-width: 1000px)').matches) { setFittedStageWidth(previous => previous === null ? previous : null); return; }
      const canvasStyle = view.getComputedStyle(canvas);
      const contentWidth = canvas.clientWidth - (parseFloat(canvasStyle.paddingLeft) || 0) - (parseFloat(canvasStyle.paddingRight) || 0);
      const contentHeight = canvas.clientHeight - (parseFloat(canvasStyle.paddingTop) || 0) - (parseFloat(canvasStyle.paddingBottom) || 0);
      let siblingsHeight = 0;
      for (const child of Array.from(canvas.children)) {
        if (child.classList.contains('stage')) continue;
        const childStyle = view.getComputedStyle(child);
        siblingsHeight += child.getBoundingClientRect().height + (parseFloat(childStyle.marginTop) || 0) + (parseFloat(childStyle.marginBottom) || 0);
      }
      const next = stageFitWidth(contentWidth, contentHeight, siblingsHeight);
      if (next !== undefined) setFittedStageWidth(previous => previous === next ? previous : next);
    };
    measure();
    const Observer = view.ResizeObserver; if (!Observer) return;
    const observer = new Observer(measure); observer.observe(canvas);
    return () => observer.disconnect();
  }, [placedFitCount, reviewSide]);

  const key = (asset: ProjectAsset) => asset.storageKey || asset.name;
  const assetsByKey = useMemo(() => new Map((project.assets || []).map(a => [key(a), a])), [project.assets]);
  const controls = project.controls || [];
  const visibleControls = useMemo(() => controls.filter(c => !c.sequenceOnly), [controls]);
  const control = selection?.kind === "control" ? controls.find(c => c.id === selection.id) : undefined;
  const asset = selection?.kind === "asset" ? assetsByKey.get(selection.id) : control?.action.startsWith("asset.show.") ? assetsByKey.get(control.action.slice(11)) : undefined;
  const tool = (project.gameTools || []).find(t => selection?.kind === "tool" ? t.id === selection.id : control?.toolIds?.includes(t.id));
  const fxResult = control?.overlayResult || defaultOverlayResult;
  const canFx = !!control && control.toolIds?.length !== 1 && !control.action.startsWith("result.hide.");
  const facts = control ? buttonFacts(control, project) : null;
  const hasVisualResult = control?.action !== 'sequence' && !!control && tool?.type !== 'youtube' && !control.action.startsWith("result.hide.") && (!asset || mediaKind(asset) !== "audio");
  const youtube = (project.gameTools || []).find(t => t.type === "youtube" && t.enabled);

  // The save paths are the existing ones (the same helpers the old
  // Build Space inspector used): every update spreads the current
  // project, so anything this surface does not touch — including
  // fields from older versions of the app — is preserved as-is.
  function saveTool(next: GameTool) {
    const current = currentProject.current;
    const p = next.config.placement as { x: number; y: number; width: number; height: number } | undefined;
    const placement = p ? toolShapePlacement(p, String((next.config.appearance as Record<string, unknown> | undefined)?.shape || '')) : undefined;
    const updated = placement ? { ...next, config: { ...next.config, placement } } : next;
    save({ ...current, name: titleFromToolSave(current, updated), gameTools: (current.gameTools || []).map(t => t.id === next.id ? updated : t), controls: placement ? (current.controls || []).map(c => c.toolIds?.length === 1 && c.toolIds[0] === next.id ? { ...c, overlayResult: { ...(c.overlayResult || defaultOverlayResult), ...placement } } : c) : (current.controls || []) });
  }
  function updateControl(id: string, patch: Partial<ProjectEvent>) {
    const current = currentProject.current, target = (current.controls || []).find(c => c.id === id), t = target?.toolIds?.length === 1 ? (current.gameTools || []).find(t => t.id === target.toolIds![0]) : undefined;
    if (patch.overlayResult && t && t.type !== 'youtube') { saveTool({ ...t, config: { ...t.config, placement: normalizePlacement(patch.overlayResult) } }); return; }
    save({ ...current, controls: (current.controls || []).map(c => c.id === id ? { ...c, ...patch } : c) });
  }
  function setControlEffect(entrance: OverlayResult['entrance']) {
    if (!control) return; const current = currentProject.current, target = (current.controls || []).find(c => c.id === control.id); if (!target) return;
    const overlayResult = controlEffectResult(target, current, entrance);
    save({ ...current, controls: (current.controls || []).map(c => c.id === control.id ? { ...c, overlayResult } : c) });
  }
  function updateAsset(id: string, patch: Partial<ProjectAsset>) { const current = currentProject.current; save({ ...current, assets: (current.assets || []).map(a => key(a) === id ? { ...a, ...patch } : a) }); }

  // ---- Dashboard drag-to-reorder -------------------------------------
  // A press that stays put is a click and FIRES the button, exactly as
  // published. Movement past the threshold becomes a drag: the button
  // can be carried to a new slot, and releasing writes the new order
  // (visible buttons only; hidden sequence steps keep their slots).
  const buttonRefs = useRef(new Map<string, HTMLButtonElement>());
  const buttonDrag = useRef<{ id: string; x: number; y: number; moved: boolean; over: number } | null>(null);
  const suppressClick = useRef(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  function indexAtPoint(x: number, y: number) {
    let best = visibleControls.length - 1, bestDist = Infinity;
    visibleControls.forEach((c, i) => {
      const el = buttonRefs.current.get(c.id); if (!el) return;
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) { best = i; bestDist = -1; }
      else if (bestDist >= 0) {
        const dx = Math.max(r.left - x, 0, x - r.right), dy = Math.max(r.top - y, 0, y - r.bottom);
        const dist = dx * dx + dy * dy;
        if (dist < bestDist) { bestDist = dist; best = i; }
      }
    });
    return best;
  }
  function buttonPointerDown(event: ReactPointerEvent<HTMLButtonElement>, c: ProjectEvent, index: number) {
    if (event.button !== 0) return;
    buttonDrag.current = { id: c.id, x: event.clientX, y: event.clientY, moved: false, over: index };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function buttonPointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = buttonDrag.current; if (!drag) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 6) return;
    if (!drag.moved) { drag.moved = true; setDraggingId(drag.id); }
    drag.over = indexAtPoint(event.clientX, event.clientY);
    setDragOver(drag.over);
  }
  function buttonPointerUp() {
    const drag = buttonDrag.current; buttonDrag.current = null;
    setDraggingId(null); setDragOver(null);
    if (!drag || !drag.moved) return;
    suppressClick.current = true;
    const from = visibleControls.findIndex(c => c.id === drag.id);
    if (from < 0) return;
    const list = visibleControls.filter(c => c.id !== drag.id);
    list.splice(Math.max(0, Math.min(list.length, drag.over)), 0, visibleControls[from]);
    if (list.some((c, i) => c.id !== visibleControls[i].id)) {
      const current = currentProject.current;
      save({ ...current, controls: reorderVisibleControls(current.controls || [], list.map(c => c.id)) });
    }
  }
  function buttonPointerCancel() { buttonDrag.current = null; setDraggingId(null); setDragOver(null); }

  const placedAssets = (project.assets || []).filter(a => a.inProject && a.url && a.role !== "background" && mediaKind(a) !== "audio");
  const placedBoards = (project.gameTools || []).filter(t => t.enabled && t.inOverlayBuild && (t.type === "blank-board" || t.type === "trivia-board"));
  const toolPlacement = (t: GameTool): Placement => {
    const p = (t.config.placement || {}) as Partial<Placement>;
    return normalizePlacement({ x: p.x ?? 15, y: p.y ?? 15, width: p.width ?? 70, height: p.height ?? 60 });
  };

  return (
    <section className="stage-review" aria-label="Set the Stage review spaces">
      <div className="stage-review-jewel">
        <JewelWandScene onEnter={onEnterJewel} />
        {jewelPanel}
      </div>
      <div className="stage-review-spot">
        <div className="sr-review-toggle" role="tablist" aria-label="Choose a review area">
          <button type="button" role="tab" aria-selected={reviewSide === "overlay"} className={reviewSide === "overlay" ? "active" : ""} onClick={() => setReviewSide("overlay")}>Overlay</button>
          <button type="button" role="tab" aria-selected={reviewSide === "dashboard"} className={reviewSide === "dashboard" ? "active" : ""} onClick={() => setReviewSide("dashboard")}>Dashboard</button>
        </div>
        {reviewSide === "overlay" ? (
        <section ref={overlayCanvasRef} role="tabpanel" className="sr-canvas assembly-canvas" aria-label="Overlay review">
          <div className="sr-review-head"><h3>Overlay review</h3><span>Exactly what your audience will see — drag anything to move it.</span></div>
          <div className="stage" style={fittedStageWidth ? { width: fittedStageWidth } : undefined}>
            <BuildOverlayPreview>
              {overlay}
              {tool && !control && !(infoTypes.includes(tool.type) && cardStates[tool.id] && !cardStates[tool.id].cleared) && !['question-card', 'blank-card', 'card-list', 'youtube', 'random-picker'].includes(tool.type) && (
                <ControlAppearancePreview state={cardStates[tool.id]} control={{ id: 'editing-' + tool.id, label: tool.name, detail: 'Editing preview', action: `tool.${tool.id}`, toolIds: [tool.id], overlayResult: { ...defaultOverlayResult, ...(tool.config.placement as Partial<typeof defaultOverlayResult> || {}) } }} project={project} />
              )}
              {control && hasVisualResult && !(tool && infoTypes.includes(tool.type) && cardStates[tool.id] && !cardStates[tool.id].cleared) && (
                <ControlAppearancePreview state={tool ? cardStates[tool.id] : undefined} control={{ ...control, overlayResult: control.overlayResult || defaultOverlayResult }} project={project} />
              )}
            </BuildOverlayPreview>
            <div ref={stageFrameRef} className="sr-draglayer">
              {placedAssets.map(a => (
                <StageDragBox key={key(a)} label={a.name} canvasRef={stageFrameRef}
                  placement={a.edits?.placement ? normalizePlacement(a.edits.placement) : { x: 57, y: 34, width: 38, height: 58 }}
                  selected={selection?.kind === "asset" && selection.id === key(a)}
                  onSelect={() => setSelection({ kind: "asset", id: key(a) })}
                  onCommit={placement => updateAsset(key(a), { edits: { ...a.edits, placement } })} />
              ))}
              {placedBoards.map(t => (
                <StageDragBox key={t.id} label={t.name} canvasRef={stageFrameRef}
                  placement={toolPlacement(t)}
                  selected={selection?.kind === "tool" && selection.id === t.id}
                  onSelect={() => setSelection({ kind: "tool", id: t.id })}
                  onCommit={placement => saveTool({ ...currentProject.current.gameTools.find(x => x.id === t.id)!, config: { ...currentProject.current.gameTools.find(x => x.id === t.id)!.config, placement } })} />
              ))}
              {tool && tool.type !== 'youtube' && tool.type !== 'question-card' && tool.type !== 'blank-card' && tool.type !== 'random-picker' && tool.inOverlayBuild && !placedBoards.some(t => t.id === tool.id) && (
                <StageDragBox key={'tool-' + tool.id} label={tool.name} canvasRef={stageFrameRef}
                  placement={toolPlacement(tool)}
                  selected
                  onSelect={() => setSelection({ kind: "tool", id: tool.id })}
                  onCommit={placement => saveTool({ ...currentProject.current.gameTools.find(x => x.id === tool.id)!, config: { ...currentProject.current.gameTools.find(x => x.id === tool.id)!.config, placement } })} />
              )}
              {control && hasVisualResult && (
                <StageDragBox key={'control-' + control.id} label={control.label} canvasRef={stageFrameRef}
                  placement={normalizePlacement(control.overlayResult || defaultOverlayResult)}
                  selected
                  onSelect={() => setSelection({ kind: "control", id: control.id })}
                  onCommit={placement => updateControl(control.id, { overlayResult: { ...(control.overlayResult || defaultOverlayResult), ...placement } })} />
              )}
              {tool?.type === 'youtube' && positionYoutube && (
                <YouTubePlacementEditor key={tool.id} label="Video position (editing only)" placement={safeYoutubePlacement(tool.config.placement)} onChange={placement => saveTool({ ...currentProject.current.gameTools.find(t => t.id === tool.id)!, config: { ...currentProject.current.gameTools.find(t => t.id === tool.id)!.config, placement } })} />
              )}
            </div>
          </div>
          {!(project.assets || []).some(a => a.inProject) && !(project.gameTools || []).some(t => t.inOverlayBuild) && !controls.length && (
            <p className="sr-empty">Nothing staged yet — ask Jewel to place your background and your first items, and they will appear here exactly as your audience will see them.</p>
          )}
          {!(project.assets || []).some(a => a.inProject) && !(project.gameTools || []).some(t => t.inOverlayBuild) && controls.length > 0 && (
            <p className="sr-empty">Your buttons are ready — press one on the dashboard review and its result appears here. A background is optional; ask Jewel to add one anytime.</p>
          )}
        </section>
        ) : (
        <section role="tabpanel" className="sr-canvas assembly-canvas" aria-label="Dashboard review">
          <div className="sr-review-head"><h3>Dashboard review</h3><span>Your host controls — press them: they work here exactly as they will live. Drag a button to reorder it; ✎ edits it.</span></div>
          {sequenceRunning && <button type="button" onClick={onStopSequence}>Stop sequence</button>}
          <div role="status" aria-live="polite">{sequenceError || feedback}</div>
          {onResetGame && (
            <div className="build-reset-row">
              {!resetConfirm ? (
                <button type="button" onClick={() => setResetConfirm(true)}>Reset game</button>
              ) : (
                <div role="alert" className="build-reset-confirm">
                  <p>Reset the whole game to its opening? Everything showing will clear, and every tool goes back to its starting state.</p>
                  <label><input type="checkbox" checked={resetWipe} onChange={event => setResetWipe(event.target.checked)} /> Also put the wheel categories back to how the game was built</label>
                  <div className="build-reset-actions">
                    <button type="button" onClick={() => { setResetConfirm(false); onResetGame(resetWipe); }}>Yes, reset game</button>
                    <button type="button" onClick={() => setResetConfirm(false)}>Keep playing</button>
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="dashboard-canvas">
            {!visibleControls.length && !dashboardExtras && <p className="sr-empty">No buttons yet — ask Jewel to put your first control here.</p>}
            <div className="dashboard-preview-buttons sr-buttons">
              {visibleControls.map((c, index) => (
                <div key={c.id} className={"sr-buttonwrap" + (draggingId === c.id ? " dragging" : "") + (dragOver === index && draggingId !== c.id ? " drop-target" : "")}>
                  <button type="button" style={controlButtonStyle(c)} aria-pressed={control?.id === c.id}
                    ref={el => { if (el) buttonRefs.current.set(c.id, el); else buttonRefs.current.delete(c.id); }}
                    onPointerDown={e => buttonPointerDown(e, c, index)}
                    onPointerMove={buttonPointerMove}
                    onPointerUp={buttonPointerUp}
                    onPointerCancel={buttonPointerCancel}
                    onClick={() => {
                      if (suppressClick.current) { suppressClick.current = false; return; }
                      onTrigger(c);
                    }}>
                    {controlLabel(project, c, cardStates)}<small>{c.detail || "Choose an action"}</small>
                  </button>
                  <button type="button" className="sr-editbtn" aria-label={`Edit ${c.label}`} onClick={() => setSelection({ kind: "control", id: c.id })}>✎</button>
                </div>
              ))}
            </div>
            {dashboardExtras?.()}
            {(project.gameTools || []).filter(t => t.enabled && t.inToolbox && t.type === "wheel").map(t => (
              <WheelHostPanel key={t.id} tool={t} onSave={segments => onChange({ ...project, gameTools: (project.gameTools || []).map(x => x.id === t.id ? { ...x, config: { ...x.config, segments } } : x) })} />
            ))}
            {youtubeOpen && youtube && (
              <div className="youtube-draft-testing">
                <button type="button" className="outline-btn" onClick={onCloseYoutube}>Close YouTube search</button>
                <p>Private search stays on this dashboard. Choose a video, then send it to the overlay when ready.</p>
                <YouTubeHostPanel canShow={true} onCommand={onYoutubeCommand} previewState={youtubeState} previewFeedback={youtubeFeedback} placement={safeYoutubePlacement(youtube.config.placement)} />
              </div>
            )}
          </div>
        </section>
        )}

        {selection && (asset || tool || control) && (
          <section ref={settings} className="sr-inspector assembly-settings" aria-label="Selected item settings">
            <h3>Set up: {tool?.type === 'youtube' ? 'YouTube search' : asset?.name || tool?.name || control?.label}</h3>
            {facts && (
              <section className="button-facts" aria-label="What this button does">
                <p><strong>Does:</strong> {facts.does}</p>
                {facts.effect && canFx && (
                  <label>Comes in with
                    <select aria-label="Entrance effect" value={fxResult.entrance || "none"} onChange={e => setControlEffect(e.target.value as OverlayResult["entrance"])}>
                      <option value="none">No effect</option><option value="fade">Fade in</option><option value="slide">Slide in</option><option value="zoom">Zoom in</option>
                    </select>
                  </label>
                )}
                <p><strong>Clicks:</strong> {facts.clicks}</p>
              </section>
            )}
            {asset && (
              <>
                <button type="button" onClick={onWorkshop}>Edit or upload in Imagine and Create</button>
                {mediaKind(asset) !== "audio" && (
                  <section className="build-media-fit" aria-label="Media fit">
                    <h4>Fit to 1920 × 1080 overlay</h4>
                    <p>Show the whole image or video, or fill the frame with cropped edges.</p>
                    <button type="button" onClick={() => updateAsset(key(asset), { edits: { ...asset.edits, fit: "contain", placement: { x: 0, y: 0, width: 100, height: 100 }, zoom: 1, rotation: 0, offsetX: 0, offsetY: 0 } })}>Show full media</button>
                    <button type="button" onClick={() => updateAsset(key(asset), { edits: { ...asset.edits, fit: "cover", placement: { x: 0, y: 0, width: 100, height: 100 }, zoom: 1, rotation: 0, offsetX: 0, offsetY: 0 } })}>Fill overlay</button>
                    <label>Fit inside its placed frame
                      <select value={asset.edits?.fit || "contain"} onChange={e => updateAsset(key(asset), { edits: { ...asset.edits, fit: e.target.value as "contain" | "cover" } })}>
                        <option value="contain">Show full media · no cropping</option>
                        <option value="cover">Fill frame · crop edges</option>
                        {asset.edits?.fit === "fill" && <option value="fill">Existing stretched fit</option>}
                      </select>
                    </label>
                  </section>
                )}
                <p>{mediaKind(asset) === "audio" ? "Audio playback" : asset.role === "background" && asset.inProject ? "Initial background" : "Shown by its dashboard control"}</p>
                {(asset.type.includes("video") || asset.type.includes("audio")) && (
                  <>
                    <label>Repeat this media<input type="checkbox" checked={asset.edits?.loop ?? false} onChange={e => updateAsset(key(asset), { edits: { ...asset.edits, loop: e.target.checked } })} /></label>
                    <label>Play sound<input type="checkbox" checked={asset.edits?.sound ?? ["audio", "video"].includes(mediaKind(asset))} onChange={e => updateAsset(key(asset), { edits: { ...asset.edits, sound: e.target.checked } })} /></label>
                    <label>Volume<input type="range" min="0" max="100" value={asset.edits?.volume ?? 80} onChange={e => updateAsset(key(asset), { edits: { ...asset.edits, volume: +e.target.value } })} /></label>
                  </>
                )}
                {asset.inProject && <button type="button" onClick={() => { updateAsset(key(asset), { inProject: false }); setSelection(null); }}>Remove from overlay</button>}
              </>
            )}
            {tool && (tool.type === "question-card" || tool.type === "blank-card") && <QuestionCardEditor key={`card-editor:${tool.id}`} project={project} tool={tool} onSave={saveTool} />}
            {tool?.type === 'countdown' && <CountdownDuration key={`timer-duration:${tool.id}`} seconds={Number(tool.config.seconds) || 10} onSave={seconds => onChange({ ...project, gameTools: (project.gameTools || []).map(item => item.id === tool.id ? { ...item, config: { ...item.config, seconds } } : item) })} />}
            {tool && !["question-card", "blank-card", "youtube", "blank-board", "trivia-board"].includes(tool.type) && <GameToolEditor expanded showDuration={tool.type !== "countdown"} key={`tool-editor:${tool.id}`} project={project} tool={tool} assets={project.assets || []} ccssEntitled={ccssEntitled} onSave={saveTool} onRegisterAsset={newAsset => onChange({ ...project, assets: [...(project.assets || []), newAsset] })} />}
            {tool && (
              <>
                <p>{tool.type === "youtube" ? "YouTube search is added to your host dashboard. Press Open YouTube search during the show to find and choose a video. The search panel stays private. Only the video appears on the overlay when you send it. No YouTube search box is added to the overlay. Choose Adjust video position below only when you want to set where a chosen video will play." : "This result waits for its dashboard control during play."}</p>
                {tool.type === 'youtube' ? (
                  <>
                    <button type="button" onClick={() => { const search = controls.find(c => c.action === `tool.${tool.id}`); if (search) onOpenYoutube(); }}>Open private YouTube search</button>
                    <button type="button" aria-pressed={positionYoutube} onClick={() => setPositionYoutube(value => !value)}>{positionYoutube ? 'Hide video position guide' : 'Adjust video position'}</button>
                  </>
                ) : (
                  <button type="button" onClick={() => { onChange({ ...project, gameTools: (project.gameTools || []).map(t => t.id === tool.id ? { ...t, inOverlayBuild: false } : t) }); setSelection(null); }}>Remove from overlay</button>
                )}
              </>
            )}
            {tool?.type === 'blank-card' && <label>Text shown by this card button<textarea value={String(tool.config.text || '')} onChange={e => onChange({ ...project, gameTools: (project.gameTools || []).map(t => t.id === tool.id ? { ...t, config: { ...t.config, text: e.target.value } } : t) })} /></label>}
            {control?.action.startsWith('coin.cycle.') && (
              <section className="build-sequence-summary" aria-label="Coin button press cycle">
                <h4>One button · one action per press</h4>
                <ol><li>First press: show the coin, ready to flip.</li><li>Second press: flip the coin and reveal Heads or Tails.</li><li>Third press: remove the coin.</li></ol>
                <p>The next press starts again. Each step waits for the host. Press it on the dashboard review to run it, exactly as live.</p>
              </section>
            )}
            {control?.action === 'sequence' && (
              <section className="build-sequence-summary" aria-label="Connected sequence steps">
                <h4>Actions connected to this button</h4>
                <p>{control.sequenceMode === 'per-press' ? 'Each press performs the next action below. After the last step, the next press returns to the first.' : 'One press runs these actions in order.'}</p>
                <ol>{(control.chain || []).map(step => <li key={step.id}>{controls.find(item => item.id === step.refId)?.label || step.label}{step.timing.mode === 'delay' && Number(step.timing.seconds) > 0 ? ` · wait ${step.timing.seconds} seconds before this step` : ''}</li>)}</ol>
                <p>Ask Jewel to change what this button runs — wiring is hers now.</p>
              </section>
            )}
            {control && (
              <>
                <label>Button name on your dashboard<input value={control.label} onChange={e => updateControl(control.id, { label: e.target.value })} /></label>
                <details className="build-advanced">
                  <summary>Button colors and font</summary>
                  <label>Button color<input type="color" value={control.appearance?.backgroundColor || '#15243a'} onChange={e => updateControl(control.id, { appearance: { ...control.appearance, backgroundColor: e.target.value } })} /></label>
                  <label>Text color<input type="color" value={control.appearance?.color || '#ffffff'} onChange={e => updateControl(control.id, { appearance: { ...control.appearance, color: e.target.value } })} /></label>
                  <FontPicker value={control.appearance?.fontFamily || 'Arial, sans-serif'} onChange={fontFamily => updateControl(control.id, { appearance: { ...control.appearance, fontFamily } })} />
                </details>
                <p>During the show, the host presses this saved button. Its wiring is Jewel’s job — ask her in the conversation above to change what it does.</p>
                <button type="button" onClick={() => { onChange({ ...project, controls: controls.filter(c => c.id !== control.id) }); setSelection(null); }}>Remove from dashboard</button>
              </>
            )}
          </section>
        )}
      </div>
    </section>
  );
}
