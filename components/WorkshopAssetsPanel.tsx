"use client";

import { Dispatch, SetStateAction } from "react";
import GameToolEditor from "./GameToolEditor";
import { isImage } from "../lib/workshop-libraries";
import { assetCategory } from "../lib/asset-folders";
import { savedListEntries } from "../lib/card-lists";
import type { Project, ProjectAsset, AssetPool } from "../lib/project";
import Link from "next/link";
import CollapsibleFolder from "./CollapsibleFolder";
import AssetFolders from "./AssetFolders";
import TemplateBrowser from "./TemplateBrowser";
import AssetPoolManager from "./AssetPoolManager";
import AssetPoolAssignment from "./AssetPoolAssignment";
import AssetDetailsDialog from "./AssetDetailsDialog";
import AssetThumbnail from "./AssetThumbnail";
import { isAudio, isVideo } from "../lib/workshop-libraries";

export type WorkshopAssetsPanelProps = {
  workflowStep: number;
  workshopStep: number;
  project: Project;
  persist: (p: Project) => void;
  assetSearch: string;
  assetKindFilter: "all" | "image" | "video" | "audio" | "other";
  visibleAssets: ProjectAsset[];
  selectedAssetKey: string | null;
  setSelectedAssetKey: Dispatch<SetStateAction<string | null>>;
  selectedAsset: ProjectAsset | null;
  showBoardGuide: boolean;
  triviaBusy: boolean;
  triviaTopics: string[];
  guideBoardId: string;
  activeTrivia: string | null;
  primaryWorkshopIntent: string;
  saveStatus: string;
  dashboardLinkStatus: string | null;
  privateDashboardUrl: string;
  projectUrl: string;
  chooseWorkflowStep: (step: number, substep?: number) => void;
  openNewList: () => void;
  copyDashboardLink: () => void;
  closeTriviaQuestion: () => void;
  placeSceneImage: (index: number, role: "background" | "layer") => void;
  saveAssetPools: (assetPools: any[]) => void;
  beginBlank: () => void;
  spinWheel: () => void;
  setBackgroundIntent: Dispatch<SetStateAction<boolean>>;
  setEditingComposition: (v: any) => void;
  setPositionAssetKey: Dispatch<SetStateAction<string | null>>;
  setSideBySideTesting: Dispatch<SetStateAction<boolean>>;
  setTriviaListQuestions: Dispatch<SetStateAction<any[]>>;
  setListEditorId: Dispatch<SetStateAction<string>>;
  setNewCardEditorId: Dispatch<SetStateAction<string>>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  openWorkshopTool: (tool: "media" | "trivia" | "boards" | "tools", background?: boolean) => void;
  ccssEntitled: boolean;
  onAddTemplate: (templateId: string) => void;
  openCityCrimeScene: () => void;
  setShowBoardGuide: Dispatch<SetStateAction<boolean>>;
  setShowAssetComposer: Dispatch<SetStateAction<boolean>>;
  setAssetKindFilter: Dispatch<SetStateAction<"all" | "image" | "video" | "audio" | "other">>;
  setAssetSearch: Dispatch<SetStateAction<string>>;
  setAssetStatus: Dispatch<SetStateAction<string>>;
  setBoardDesignerId: Dispatch<SetStateAction<string>>;
  setEditingAssetIndex: Dispatch<SetStateAction<number | null>>;
  setGuideBoardId: Dispatch<SetStateAction<string>>;
  setShowTriviaListGenerator: Dispatch<SetStateAction<boolean>>;
  setTriviaListCategories: Dispatch<SetStateAction<string>>;
  setTriviaListCount: Dispatch<SetStateAction<number>>;
  setTriviaTopics: Dispatch<SetStateAction<string[]>>;
  addGameTool: (type: any) => void;
  createWorkshopCard: (kind: "question" | "blank") => void;
  deleteComposition: (id: string) => void;
  handleDeleteAsset: (asset: ProjectAsset) => void;
  pushWorkspaceCreation: (tool: any) => void;
  regenerateTrivia: (mode: "generate" | "source", categoryName?: string) => void;
  revealTriviaAnswer: (ci: number, qi: number) => void;
  toggleAssetInProject: (index: number) => void;
  toggleComposition: (id: string) => void;
  triggerTriviaQuestion: (ci: number, qi: number) => void;
  updateWheelField: (field: "title" | "segments", value: string) => void;
  useImageAsBlankBoardBackground: (index: number) => void;
  addCompositionControl: (comp: any) => void;
  TRIVIA_CONFIG: any;
  triviaConfig: any;
  selectedAssetIndex: number;
  promptRef: React.RefObject<HTMLTextAreaElement | null>;
  BackgroundDestination: any;
};

export default function WorkshopAssetsPanel(props: WorkshopAssetsPanelProps) {
  const {
    workflowStep, workshopStep, project, persist, assetSearch, assetKindFilter,
    visibleAssets, selectedAssetKey, setSelectedAssetKey, selectedAsset,
    showBoardGuide, triviaBusy, triviaTopics, guideBoardId, activeTrivia,
    primaryWorkshopIntent, saveStatus, dashboardLinkStatus, privateDashboardUrl,
    projectUrl, chooseWorkflowStep, openNewList, copyDashboardLink,
    closeTriviaQuestion, placeSceneImage, saveAssetPools, beginBlank, spinWheel,
    setBackgroundIntent, setEditingComposition, setPositionAssetKey,
    setSideBySideTesting, setTriviaListQuestions, setListEditorId, setNewCardEditorId,
    fileInputRef, openWorkshopTool, ccssEntitled, onAddTemplate, openCityCrimeScene, setShowBoardGuide, setShowAssetComposer,
    setAssetKindFilter, setAssetSearch, setAssetStatus, setBoardDesignerId,
    setEditingAssetIndex, setGuideBoardId, setShowTriviaListGenerator,
    setTriviaListCategories, setTriviaListCount, setTriviaTopics, addGameTool,
    createWorkshopCard, deleteComposition, handleDeleteAsset, pushWorkspaceCreation,
    regenerateTrivia, revealTriviaAnswer, toggleAssetInProject, toggleComposition,
    triggerTriviaQuestion, updateWheelField, useImageAsBlankBoardBackground,
    addCompositionControl, TRIVIA_CONFIG, triviaConfig, selectedAssetIndex, promptRef,
    BackgroundDestination,
  } = props;

  return (
<aside className="assets-panel" hidden={workflowStep === 0 && workshopStep === 0}>
  <div className="assets-head">
    <div>
      <small>PROJECT</small>
      <h2>{workshopStep === 2 ? "Scenes & effects" : "Your assets & tools"}</h2>
    </div>
    <button type="button" aria-label="Upload assets" hidden={workflowStep === 0 && workshopStep === 2} onClick={() => fileInputRef.current?.click()}>＋</button>
  </div>
{workflowStep === 0 && <div className="creation-tools-folder" hidden={workshopStep !== 1}><CollapsibleFolder title="Creation tools" count={ccssEntitled ? 11 : 10} description="All creation options: uploads, media, cards, boards and tools" storageKey={`${project.id}:creation-tools-compact`} keepMounted><div className="workshop-tools" role="group" aria-label="Workshop creation tools"><strong>CREATE IN WORKSHOP</strong>
  <button type="button" onClick={() => openWorkshopTool("media",true)}>Create background artwork</button>
  <button type="button" onClick={() => {chooseWorkflowStep(0,1);setBackgroundIntent(true);fileInputRef.current?.click();}}>Upload background image</button>
  <button type="button" onClick={() => {chooseWorkflowStep(0,1);setBackgroundIntent(false);fileInputRef.current?.click();}}>Upload other assets</button>
  <button type="button" onClick={() => openWorkshopTool("media")}>Generate media</button>
  <button type="button" onClick={() => openWorkshopTool("trivia")}>Generate trivia</button>
  <button type="button" onClick={() => {chooseWorkflowStep(0,1);setShowBoardGuide(true);}}>Create an interactive game board</button>
  <button type="button" onClick={() => openWorkshopTool("tools")}>Create game tools</button><button type="button" onClick={openNewList}>Create list and cards</button>
  {ccssEntitled && <button type="button" onClick={openCityCrimeScene}>City Crime Scene</button>}
  <button type="button" onClick={() => {setSideBySideTesting(false);requestAnimationFrame(()=>document.getElementById("workshop-assets")?.scrollIntoView({behavior:"smooth",block:"start"}));}}>Organize assets &amp; pools</button>
  <button type="button" onClick={() => {chooseWorkflowStep(0,2);setEditingComposition(undefined);setShowAssetComposer(true);}}>Asset Composer</button>
</div></CollapsibleFolder></div>}
{workflowStep === 0 && showBoardGuide && <section hidden={workshopStep !== 1} className="workshop-help" aria-label="Artwork and interactive board guide">
  <button type="button" className="outline-btn" aria-expanded={showBoardGuide} onClick={() => {chooseWorkflowStep(0,1);setShowBoardGuide(!showBoardGuide);}}>Combine artwork with an interactive board</button>
  {showBoardGuide && <div className="workshop-help-grid">
    <article><h3>1. Choose how your board works</h3><p>Artwork gives your board its look. The interactive board supplies selectable areas and reveal behavior. Both are saved in this project.</p><button type="button" className="outline-btn" onClick={() => openWorkshopTool("boards")}>Choose a board template</button><button type="button" className="outline-btn" onClick={() => void addGameTool("blank-board")}>Create a custom board</button></article>
    <article><h3>2. Create or upload the artwork</h3><p>Generate a new image, upload your own, or use an image already saved below.</p><button type="button" className="outline-btn" onClick={() => openWorkshopTool("media",true)}>Generate board artwork</button><button type="button" className="outline-btn" onClick={() => {setBackgroundIntent(true);fileInputRef.current?.click();}}>Upload board artwork</button></article>
    <article><h3>3. Connect artwork to your custom board</h3><p>Choose the custom board, then an image. This saves the image as that board’s background; your other images remain available.</p><label htmlFor="guide-board">Custom board<select id="guide-board" value={guideBoardId} onChange={event => setGuideBoardId(event.target.value)}><option value="">Choose a custom board</option>{(project.gameTools || []).filter(tool => tool.type === "blank-board").map(tool => <option key={tool.id} value={tool.id}>{tool.name}</option>)}</select></label>
    {!(project.gameTools || []).some(tool => tool.type === "blank-board") && <p>Create a custom board in step 1 to connect your artwork.</p>}
    {project.assets.filter(isImage).length === 0 && <p>Create or upload an image in step 2 to continue.</p>}
    {project.assets.filter(isImage).map((asset,index) => <button key={(asset.storageKey || asset.name)+index} type="button" className="outline-btn" disabled={!guideBoardId} onClick={() => {const assetKey=asset.storageKey || asset.name;persist({...project,gameTools:(project.gameTools || []).map(tool => tool.id === guideBoardId ? {...tool,config:{...tool.config,backgroundAssetKey:assetKey,backgroundAssetKeys:Array.from(new Set([...(Array.isArray(tool.config?.backgroundAssetKeys) ? tool.config.backgroundAssetKeys : []),assetKey]))}} : tool),updatedAt:"just now"});setAssetStatus("Board artwork connected and saved. Use Build Space to position the board and wire its controls.");}}>Use {asset.name} as board artwork{(project.gameTools || []).find(tool => tool.id === guideBoardId)?.config?.backgroundAssetKey === (asset.storageKey || asset.name) ? " ✓" : ""}</button>)}</article>
    <article><h3>4. Assemble and test</h3><p>In Build Space, add the board to the overlay, position its interactive areas, and connect host controls. Preview the artwork and behavior together before publishing.</p><button type="button" className="build-btn" onClick={() => chooseWorkflowStep(1)}>Continue to Build Space</button></article>
  </div>}
</section>}
  <div className="detail-block" id="workshop-game-templates" hidden={workflowStep === 0 && workshopStep !== 1}>
    <h3>Game Templates</h3>
    <p className="asset-library-help">Pick a ready-made game — its tools and dashboard buttons join this project.</p>
    <TemplateBrowser project={project} onChoose={onAddTemplate} ccssEntitled={ccssEntitled}/>
  </div>
  <div className="detail-block" id="workshop-assets" hidden={workflowStep === 0 && workshopStep !== 1}>
    <h3>Media library</h3>
    <p className="asset-library-help">Open a media folder to find your assets. Select an item to edit, place it on the overlay, or add it to a game pool.</p>
    <CollapsibleFolder title="Asset pools" count={(project.assetPools || []).length} description="Named groups used by your game controls" storageKey={`${project.id}:pools`} keepMounted><AssetPoolManager pools={project.assetPools || []} assets={project.assets} onChange={saveAssetPools} saveStatus={saveStatus} /></CollapsibleFolder>
    <div className="workshop-assets-toolbar">
      <label className="workshop-assets-search">Find an asset<input type="search" value={assetSearch} onChange={event => setAssetSearch(event.target.value)} placeholder="Search by name" /></label>
      <label className="workshop-assets-filter">Show<select value={assetKindFilter} onChange={event => setAssetKindFilter(event.target.value as typeof assetKindFilter)}><option value="all">All media</option><option value="image">Images</option><option value="video">Videos</option><option value="audio">Audio</option><option value="other">Other files</option></select></label>
    </div>
    {visibleAssets.length > 0 ? <AssetFolders
      assets={visibleAssets} scope={`workshop:${project.id}`} selectedAssetKey={selectedAssetKey}
      searchKey={assetSearch.trim() || (assetKindFilter !== "all" ? `filter:${assetKindFilter}` : "")}
      renderAsset={asset => {
        const key=asset.storageKey||asset.name,kind=assetCategory(asset),selected=key===selectedAssetKey;
        return <button type="button" key={key} className={`workshop-asset-tile${selected?" selected":""}`} aria-pressed={selected} aria-label={`Select ${asset.name}, ${kind}`} onClick={()=>setSelectedAssetKey(key)}>
          <AssetThumbnail key={asset.url||key} asset={asset} kind={kind}/>
          <span className="workshop-asset-name">{asset.name}</span><small>{kind==="audio"?"Audio":kind==="other"?asset.type:kind[0].toUpperCase()+kind.slice(1)}</small>
        </button>;
      }}
    /> : <p className="empty-note">{project.assets.length===0?"Your saved assets will appear here. Create or upload something to get started.":"No assets match that search. Try a different name or media type."}</p>}
    {selectedAsset && <AssetDetailsDialog key={selectedAsset.storageKey||selectedAsset.name} label={`Actions for ${selectedAsset.name}`} onClose={()=>setSelectedAssetKey(null)}><section className="asset-detail-panel">
      <header><AssetThumbnail key={selectedAsset.url||selectedAsset.name} asset={selectedAsset} kind={assetCategory(selectedAsset)}/><div><h3>{selectedAsset.name}</h3><p>{selectedAsset.type} · {selectedAsset.inProject?"On the overlay":"In your library"}</p></div><button type="button" className="asset-detail-close" aria-label="Close asset details" onClick={()=>setSelectedAssetKey(null)}>×</button></header>
      <AssetPoolAssignment key={selectedAsset.storageKey||selectedAsset.name} asset={selectedAsset} pools={project.assetPools||[]} onChange={saveAssetPools}/>
      <p role="status">{saveStatus}</p>
      <div className="asset-detail-actions">
        {(isImage(selectedAsset)||isVideo(selectedAsset))&&<button type="button" className="build-btn" onClick={()=>{setSelectedAssetKey(null);setEditingAssetIndex(selectedAssetIndex);}}>Edit {isImage(selectedAsset)?"image":"video"}</button>}
        {(isImage(selectedAsset)||isVideo(selectedAsset))&&<><button type="button" className="outline-btn" onClick={()=>{placeSceneImage(selectedAssetIndex,"background");setSelectedAssetKey(null);}}>{selectedAsset.inProject&&selectedAsset.role==="background"?"Background selected":"Use as background"}</button><button type="button" className="outline-btn" onClick={()=>{placeSceneImage(selectedAssetIndex,"layer");setSelectedAssetKey(null);}}>{selectedAsset.inProject&&selectedAsset.role==="layer"?"Added as overlay layer":"Add as overlay layer"}</button></>}
        {!isImage(selectedAsset)&&!isVideo(selectedAsset)&&<button type="button" className="build-btn" onClick={()=>toggleAssetInProject(selectedAssetIndex)}>{selectedAsset.inProject?"Remove from overlay":"Add to overlay"}</button>}
        {selectedAsset.inProject&&selectedAsset.role!=="background"&&<button type="button" className="outline-btn" onClick={()=>{setPositionAssetKey(selectedAsset.storageKey||selectedAsset.name);setSideBySideTesting(true);setSelectedAssetKey(null);}}>Position and size on overlay</button>}
      </div>
      {isAudio(selectedAsset)&&selectedAsset.url&&<audio controls src={selectedAsset.url} style={{width:"100%"}} aria-label={`Play ${selectedAsset.name}`}/>}
      {(isVideo(selectedAsset)||isAudio(selectedAsset))&&<details className="asset-playback-options"><summary>Playback options</summary><label>Repeat this media<input type="checkbox" checked={selectedAsset.edits?.loop??isVideo(selectedAsset)} onChange={event=>persist({...project,assets:project.assets.map((asset,index)=>index===selectedAssetIndex?{...asset,edits:{...asset.edits,loop:event.target.checked}}:asset)})}/></label><label>Play sound<input type="checkbox" checked={selectedAsset.edits?.sound??isAudio(selectedAsset)} onChange={event=>persist({...project,assets:project.assets.map((asset,index)=>index===selectedAssetIndex?{...asset,edits:{...asset.edits,sound:event.target.checked}}:asset)})}/></label><label>Volume <span>{selectedAsset.edits?.volume??80}%</span><input type="range" min="0" max="100" value={selectedAsset.edits?.volume??80} onChange={event=>persist({...project,assets:project.assets.map((asset,index)=>index===selectedAssetIndex?{...asset,edits:{...asset.edits,volume:+event.target.value}}:asset)})}/></label></details>}
      {(isImage(selectedAsset)||isVideo(selectedAsset))&&<details className="asset-more-options"><summary>Other ways to use this</summary><BackgroundDestination project={project} asset={selectedAsset} onChange={persist}/>{(project.gameTools||[]).some(tool=>tool.type==="blank-board"&&tool.enabled)&&<button type="button" className="outline-btn" onClick={()=>useImageAsBlankBoardBackground(selectedAssetIndex)}>Use as board background</button>}</details>}
      <button type="button" className="danger-btn asset-detail-delete" onClick={()=>handleDeleteAsset(selectedAsset)}>Delete asset</button>
    </section></AssetDetailsDialog>}
  </div>
  <CollapsibleFolder title="Published links & sharing" storageKey={`${project.id}:sharing`} keepMounted><div className="detail-block">
    <span>PROJECT URL</span>
    <code>{projectUrl}</code>
    <Link href={privateDashboardUrl}>Open project ↗</Link>
    <button className="outline-btn" onClick={copyDashboardLink}>Copy Dashboard Link for Phone</button>
    {dashboardLinkStatus && <small role="status">{dashboardLinkStatus}</small>}
  </div></CollapsibleFolder>
  <div id="workshop-scenes" hidden={workflowStep === 0 && workshopStep !== 2}><CollapsibleFolder title="Scenes & effects" count={(project.compositions || []).length} description="Open Asset Composer or edit a saved scene" storageKey={`${project.id}:scenes`} expandKey={workshopStep === 2 ? "scenes-section" : ""} keepMounted><div className="detail-block asset-composer-launch">
    <span>ASSET COMPOSER</span>
    <p className="empty-note">Combine video, voice, music, SFX, text and effects on a synchronized multi-track timeline.</p>
    {(project.compositions || []).map(comp => <div className="saved-composition" key={comp.id}><div><b>{comp.name}</b><small>{comp.clips.length} clips · {comp.duration.toFixed(1)}s</small></div><button className="outline-btn build-only" onClick={()=>toggleComposition(comp.id)}>{comp.inProject?"✓ In Preview":"+ Add to Preview"}</button><button className="outline-btn" onClick={()=>{setEditingComposition(comp);setShowAssetComposer(true)}}>Edit</button><button className="build-btn build-only" disabled={!comp.inProject} onClick={()=>addCompositionControl(comp)}>Assign button</button><button className="danger-btn" onClick={() => deleteComposition(comp.id)}>Delete</button></div>)}
  </div></CollapsibleFolder></div>
  <div id="workshop-tools" hidden={workflowStep === 0 && workshopStep !== 1}><CollapsibleFolder title="Game tools & cards" count={project.gameTools.filter(tool => tool.type !== "youtube").length} description="Cards, boards, questions and customized tools" storageKey={`${project.id}:tools`} keepMounted><div className="detail-block">
    <span>WORKSPACE CREATIONS</span>
    <p className="empty-note">Choose templates from Creation Tools above. Edit appearance and settings below, or customize them in chat, then add finished boards to the overlay and finished tools to the dashboard toolbox.</p>
    <div className="tool-config-list">
      <div className="background-destination"><h3>Create cards for your game</h3><button type="button" onClick={openNewList}>Create list and cards</button><button type="button" onClick={()=>createWorkshopCard("question")}>Create question and answer cards</button><button type="button" onClick={()=>createWorkshopCard("blank")}>Create blank card</button></div>{(project.gameTools || []).filter(tool => tool.type !== "youtube").map(tool => (
        <CollapsibleFolder key={tool.id} title={tool.name} description={tool.type.replace(/-/g," ")} storageKey={`${project.id}:tool:${tool.id}`} keepMounted><div className="tool-config">
          <div>
            <b>{tool.name}</b>
            <em>{tool.type}</em>{(tool.type==="blank-board"||tool.type==="trivia-board")&&<button type="button" onClick={()=>setBoardDesignerId(tool.id)}>Open board designer</button>}
            {tool.type==="trivia-list" && <button type="button" onClick={()=>{setTriviaListQuestions(Array.isArray(tool.config.questions)?tool.config.questions:[]);setTriviaListCount(Number(tool.config.requestedCount)||10);setTriviaListCategories(Array.isArray(tool.config.suggestedCategories)?tool.config.suggestedCategories.join(", "):"");setShowTriviaListGenerator(true);promptRef.current?.scrollIntoView({behavior:"smooth",block:"center"});}}>Review saved questions</button>}
            {tool.type==="card-list"?<><p>{savedListEntries(tool).length} pool entries · {Array.isArray(tool.config.cards)?tool.config.cards.length:0} cards</p><button type="button" onClick={()=>setListEditorId(tool.id)}>Open pool and card designer</button></>: (tool.type==="question-card"||tool.type==="blank-card")?<button type="button" onClick={()=>setNewCardEditorId(tool.id)}>Customize cards</button>:<GameToolEditor key={tool.id} tool={tool} project={project} assets={project.assets} onSave={next=>persist({...project,gameTools:(project.gameTools||[]).map(x=>x.id===next.id?next:x),updatedAt:"just now"})} onRegisterAsset={asset=>persist({...project,assets:[...(project.assets||[]),asset],updatedAt:"just now"})}/>}
          </div>
          <small>{(tool.type==="trivia-board" || tool.type==="blank-board") ? (tool.inOverlayBuild ? "✓ In Overlay Build" : "Board customization workspace") : (tool.inToolbox ? "✓ In Dashboard Toolbox" : "Tool customization workspace")}</small>{(tool.type === "trivia-board" || tool.type === "blank-board") ? <button className="build-btn build-only" disabled={tool.inOverlayBuild} onClick={()=>pushWorkspaceCreation(tool)}>{tool.inOverlayBuild ? "Added to Overlay Build" : "Add to Overlay Build"}</button> : <small>{tool.type === "youtube" ? "Connected to dashboard and overlay · test in the preview before publishing" : "Saved in Toolbox · connect to a button in Build Space when needed"}</small>}
        </div></CollapsibleFolder>
      ))}
    </div>
    {(project.gameTools || []).some(t => t.name === "Trivia Board") && (
      <div className="trivia-dashboard">
        <strong>TRIVIA BOARD</strong>
        <small>Choose a question to fill the live overlay. Every question is source-backed; regenerate topics or questions whenever you want.</small>
        <div className="trivia-actions">
          <button className="outline-btn" disabled={triviaBusy} onClick={() => regenerateTrivia("generate")}>↻ Regenerate sourced board</button>
          <button className="outline-btn" disabled={triviaBusy} onClick={() => regenerateTrivia("source")}>↻ Refresh sources</button>
        </div>
        <div className="trivia-topic-editor">
          <small>TOPICS</small>
          {(triviaConfig || TRIVIA_CONFIG).categories.map((cat: any, i: number) => (
            <input
              key={i}
              value={triviaTopics[i] ?? cat.name}
              onChange={e => setTriviaTopics(v => v.map((x, idx) => idx === i ? e.target.value : x))}
              placeholder={`Category ${i + 1}`}
            />
          ))}
        </div>
        <div className="trivia-grid">
          {(triviaConfig || TRIVIA_CONFIG).categories.map((cat: any, ci: number) => (
            <div className="trivia-column" key={cat.name}>
              <div className="trivia-column-head">
                <b>{cat.name}</b>
                <button onClick={() => regenerateTrivia("generate", cat.name)} disabled={triviaBusy}>↻</button>
              </div>
              {cat.questions.map((q: any, qi: number) => (
                <div className="trivia-cell" key={q.value}>
                  <button
                    className={q.used ? "trivia-used" : ""}
                    disabled={q.used}
                    onClick={() => triggerTriviaQuestion(ci, qi)}
                  >
                    {q.used ? "USED" : `${q.value}`}
                  </button>
                  {activeTrivia === `${ci}:${qi}` && (
                    <button className="trivia-reveal-btn" onClick={() => revealTriviaAnswer(ci, qi)}>
                      Reveal
                    </button>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
        <button className="outline-btn" onClick={closeTriviaQuestion}>Close current clue</button>
      </div>
    )}
  </div></CollapsibleFolder></div>
  <CollapsibleFolder title="Wheel settings" storageKey={`${project.id}:wheel`} keepMounted><div className="detail-block">
    <span>WHEEL SETTINGS</span>
    {project.wheel?.enabled ? (
      <>
        <input className="wheel-input" value={project.wheel.title} onChange={e => updateWheelField("title", e.target.value)} placeholder="Wheel title" />
        <input className="wheel-input" value={project.wheel.segments.join(", ")} onChange={e => updateWheelField("segments", e.target.value)} placeholder="Prize, Challenge, Bonus" />
        <button className="outline-btn" onClick={spinWheel}>↻ Trigger wheel</button>
      </>
    ) : (
      <p className="empty-note">Add the Game Wheel from the library when you need it.</p>
    )}
  </div></CollapsibleFolder>
  <div className="detail-block">
    <span>NEW PROJECT</span>
    <button className="outline-btn" onClick={beginBlank}>＋ Start fresh</button>
  </div>
</aside>
  );
}
