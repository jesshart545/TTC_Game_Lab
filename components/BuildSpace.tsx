"use client";
import BuildOverlayPreview from "./BuildOverlayPreview";
import DashboardSequenceEditor from "./DashboardSequenceEditor";
import {normalizePlacement,toolShapePlacement} from '../lib/overlay-placement';
import FontPicker from './FontPicker';
import CountdownDuration from "./CountdownDuration";
import { useState, useEffect, useRef, useMemo, type ReactNode } from "react";
import type { Project, ProjectEvent, ProjectAsset, GameTool } from "../lib/project";
import {controlLabel,controlButtonStyle,toolDefaults,infoTypes} from "../lib/game-tools";
import type {CardState} from "../lib/question-cards";
import type { YouTubeState } from "../lib/youtube";
import { safeYoutubePlacement } from "../lib/youtube";
import { defaultOverlayResult } from "./CompositionPlayer";
import WheelHostPanel from "./WheelHostPanel";
import AssetThumbnail from "./AssetThumbnail";
import BackgroundBrowser from "./BackgroundBrowser";
import TemplateBrowser from "./TemplateBrowser";
import QuestionCardEditor from "./QuestionCardEditor";
import GameToolEditor from "./GameToolEditor";
import {assignControlAction} from "../lib/control-connections";
import {addCreationControl} from "../lib/build-controls";
import {additionTypes,creationsForType,creationControls,type AdditionType,type BuildCreation} from "../lib/build-guide";
import {mediaKind} from "../lib/board-design";
import {assetCategory} from "../lib/asset-folders";
import {buildReadiness} from "../lib/build-readiness";
import {cardControl} from "../lib/question-cards";
import { ControlAppearancePreview } from "./RuntimeActionLayers";
import YouTubePlacementEditor from "./YouTubePlacementEditor";
import YouTubeHostPanel from "./YouTubeHostPanel";
import DashboardButtonReview from './DashboardButtonReview';
import {addReviewedButtons} from '../lib/reviewed-buttons';
import DashboardActionPicker from './DashboardActionPicker';

function BuildAssetThumbnail({asset,label,onSelect,selected}:{asset?:ProjectAsset;label:string;onSelect:()=>void;selected?:boolean}) {
 if(!asset)return null;
 const kind=mediaKind(asset);
 if(kind!=="image"&&kind!=="video")return null;
 return <button type="button" className="build-asset-thumbnail" aria-label={label} aria-pressed={selected} onClick={onSelect}><AssetThumbnail key={asset.url||asset.storageKey||asset.name} asset={asset} kind={kind}/></button>;
}

export type BuildEntryRequest = { task: "background" | "add" | "test"; request: number };

type Props={onAskAi?:()=>void;entryRequest?:BuildEntryRequest|null;onEntryHandled?:(request:number)=>void;showNextGuidance?:boolean;focusControl?:{id:string;request:number}|null;sequenceRunning:boolean;sequenceError:string;onStopSequence:()=>void;onResetGame?:(wipeEdits:boolean)=>void;cardStates:Record<string,CardState>;onSelect:(selection:{kind:string;id:string}|null)=>void;project:Project;onChange:(project:Project)=>void;overlay:ReactNode;onTrigger:(control:ProjectEvent)=>void;onWorkshop:()=>void;youtubeOpen:boolean;onOpenYoutube:()=>void;onCloseYoutube:()=>void;onYoutubeCommand:(command:Record<string,unknown>)=>Promise<YouTubeState>;youtubeState:YouTubeState|null;youtubeFeedback:{playbackId:string;status:string;errorCode?:number}|null;dashboardExtras?:(toolId?:string)=>ReactNode;feedback?:string;onPublishStep:()=>void;ccssEntitled?:boolean;onAddTemplate:(templateId:string)=>void};
export default function BuildSpace({onAskAi,entryRequest,onEntryHandled,showNextGuidance=true,focusControl,sequenceRunning,sequenceError,onStopSequence,onResetGame,cardStates,onSelect,project,onChange,overlay,onTrigger,onWorkshop,youtubeOpen,onOpenYoutube,onCloseYoutube,onYoutubeCommand,youtubeState,youtubeFeedback,dashboardExtras,feedback,onPublishStep,ccssEntitled=false,onAddTemplate}:Props){
 const assemblyRef=useRef<HTMLElement>(null);
 useEffect(()=>{if(assemblyRef.current?.ownerDocument.defaultView?.matchMedia?.('(min-width: 1000px)').matches)assemblyRef.current?.scrollIntoView({block:'start'});},[]);
 const currentProject=useRef(project);currentProject.current=project;
 const save=(next:Project)=>{currentProject.current=next;onChange(next);};
 const [testing,setTesting]=useState(false),[selection,setSelection]=useState<{kind:"asset"|"tool"|"control";id:string}|null>(null);
 useEffect(()=>onSelect(selection),[selection,onSelect]);
 useEffect(()=>{
  if(!selection)return;
  const exists=selection.kind==='control'?project.controls.some(c=>c.id===selection.id):selection.kind==='tool'?project.gameTools.some(t=>t.id===selection.id):project.assets.some(a=>(a.storageKey||a.name)===selection.id);
  if(!exists)setSelection(null);
 },[selection,project.controls,project.gameTools,project.assets]);
 const [step,setStep]=useState(0);
 const [positionYoutube,setPositionYoutube]=useState(false);
 const [resetConfirm,setResetConfirm]=useState(false);
 const [resetWipe,setResetWipe]=useState(true);
 useEffect(()=>setPositionYoutube(false),[selection?.id,testing]);
 const [additionType,setAdditionType]=useState<AdditionType>("image");
 const [stageSide,setStageSide]=useState<"overlay"|"dashboard">("overlay");
 const [libraryFamily,setLibraryFamily]=useState<"pictures"|"video"|"music"|"sounds"|"tools"|"features"|"templates"|"effects">("pictures");
 const [activeCreation,setActiveCreation]=useState<BuildCreation|null>(null);
 const [pendingAddition,setPendingAddition]=useState<{creation:BuildCreation;controls:ProjectEvent[];newTool?:GameTool}|null>(null);
 const guide=additionTypes.find(item=>item.id===additionType)!;
 const creations=useMemo(()=>Object.fromEntries(additionTypes.map(item=>[item.id,creationsForType(project,item.id)])) as Record<AdditionType,BuildCreation[]>,[project.assets,project.gameTools,project.compositions]);
 const choices=creations[additionType];
 const choiceConnections=useMemo(()=>new Map(choices.map(item=>[item.id,creationControls(project,item)])),[choices,project.controls]);
 const connected=useMemo(()=>activeCreation?creationControls(project,activeCreation):[],[activeCreation,project.controls]);
 const pickCreation=(c:BuildCreation)=>{const existing=creationControls(project,c);if(!existing.length){setStep(1);setSelection(null);setTesting(false);reviewCreation(c.kind,c.id);return;}setActiveCreation(c);setStep(2);setTesting(false);setSelection({kind:'control',id:existing[0].id});if(project.gameTools.some(t=>t.type==='youtube'&&t.id===c.id))onOpenYoutube();};
 const hasBackground=project.assets.some(a=>a.inProject&&a.role==="background")||project.gameTools.some(t=>t.enabled&&t.inOverlayBuild&&(t.type==="blank-board"||t.type==="trivia-board"));
 function nextType(){setActiveCreation(null);setSelection(null);setPendingAddition(null);goStep(3);}
 const settings=useRef<HTMLElement>(null);
 useEffect(()=>{if(selection&&!testing)settings.current?.scrollIntoView({behavior:"smooth",block:"nearest"});},[selection,testing]);
 useEffect(()=>{if(!focusControl)return;setActiveCreation(null);setTesting(false);setStep(2);setSelection({kind:'control',id:focusControl.id});},[focusControl]);
 useEffect(()=>{
  if(!entryRequest)return;
  setActiveCreation(null);
  goStep(entryRequest.task==="background"?0:entryRequest.task==="add"?1:3);
 },[entryRequest]);
 useEffect(()=>{
  if(!entryRequest)return;
  const expected=entryRequest.task==="background"?0:entryRequest.task==="add"?1:3;
  if(step!==expected)return;
  const selector=entryRequest.task==="background"?'.build-background-browser input':entryRequest.task==="add"?'[aria-label="Addition type"]':'.dashboard-preview-buttons button';
  const target=assemblyRef.current?.querySelector<HTMLElement>(selector)||assemblyRef.current?.querySelector<HTMLElement>('.build-guidance');
  target?.scrollIntoView({behavior:"smooth",block:"center"});
  target?.focus({preventScroll:true});
  onEntryHandled?.(entryRequest.request);
 },[step,entryRequest,onEntryHandled]);
 const issues=useMemo(()=>step===4?buildReadiness(project):[],[step,project]);
 function goStep(next:number){setStep(next);setTesting(next===3);if(next!==2&&next!==3)setSelection(null);}
 const key=(asset:ProjectAsset)=>asset.storageKey||asset.name;
 const assetsByKey=useMemo(()=>new Map(project.assets.map(a=>[key(a),a])),[project.assets]);
 const control=selection?.kind==="control"?project.controls.find(c=>c.id===selection.id):undefined;
 const musicCreations=useMemo(()=>creations.audio.filter(c=>{const a=assetsByKey.get(c.id);return !!a&&assetCategory(a)!=="sfx";}),[creations,assetsByKey]);
 const soundCreations=useMemo(()=>creations.audio.filter(c=>{const a=assetsByKey.get(c.id);return !!a&&assetCategory(a)==="sfx";}),[creations,assetsByKey]);
 const featureCreations=useMemo(()=>additionTypes.filter(t=>!["image","video","audio"].includes(t.id)).flatMap(t=>creations[t.id]),[creations]);
 const creatableTypes=additionTypes.filter(t=>!["image","video","audio","composition","question-card","blank-card"].includes(t.id));
 const fxResult=control?.overlayResult||defaultOverlayResult;
 const canFx=!!control&&control.toolIds?.length!==1&&!control.action.startsWith("result.hide.");

 const asset=selection?.kind==="asset"?assetsByKey.get(selection.id):control?.action.startsWith("asset.show.")?assetsByKey.get(control.action.slice(11)):undefined;
 const tool=project.gameTools.find(t=>selection?.kind==="tool"?t.id===selection.id:control?.toolIds?.includes(t.id));
 const hasVisualResult=control?.action!=='sequence'&&!!control&&tool?.type!=='youtube'&&!control.action.startsWith("result.hide.")&&(!asset||mediaKind(asset)!=="audio");
 const youtube=project.gameTools.find(t=>t.type==="youtube"&&t.enabled);
 function saveTool(next:GameTool){
  const current=currentProject.current;
  const p=next.config.placement as {x:number;y:number;width:number;height:number}|undefined;
  const placement=p?toolShapePlacement(p,String((next.config.appearance as Record<string,unknown>|undefined)?.shape||'')):undefined;
  const updated=placement?{...next,config:{...next.config,placement}}:next;
  save({...current,gameTools:current.gameTools.map(t=>t.id===next.id?updated:t),controls:placement?current.controls.map(c=>c.toolIds?.length===1&&c.toolIds[0]===next.id?{...c,overlayResult:{...(c.overlayResult||defaultOverlayResult),...placement}}:c):current.controls});
 }
 function updateControl(id:string,patch:Partial<ProjectEvent>){
  const current=currentProject.current,target=current.controls.find(c=>c.id===id),t=target?.toolIds?.length===1?current.gameTools.find(t=>t.id===target.toolIds![0]):undefined;
  if(patch.overlayResult&&t&&t.type!=='youtube'){saveTool({...t,config:{...t.config,placement:normalizePlacement(patch.overlayResult)}});return;}
  save({...current,controls:current.controls.map(c=>c.id===id?{...c,...patch}:c)});
 }
 function updateAsset(id:string,patch:Partial<ProjectAsset>){const current=currentProject.current;save({...current,assets:current.assets.map(a=>key(a)===id?{...a,...patch}:a)});}
 function chooseCreation(kind:'asset'|'tool'|'composition',id:string){const creation=Object.values(creations).flat().find(c=>c.kind===kind&&c.id===id)||{kind,id,name:project.gameTools.find(t=>t.id===id)?.name||'Selected item'};const existing=creationControls(project,creation);if(!existing.length){reviewCreation(kind,id);return;}setActiveCreation(creation);setStep(2);setTesting(false);setSelection({kind:'control',id:existing[0].id});if(project.gameTools.some(t=>t.type==='youtube'&&t.id===id))onOpenYoutube();}
 function reviewCreation(kind:'asset'|'tool'|'composition',id:string,newTool?:GameTool){
  const current=currentProject.current,base=newTool?{...current,gameTools:[...current.gameTools,newTool]}:current;
  const creation=Object.values(creations).flat().find(c=>c.kind===kind&&c.id===id)||{kind,id,name:newTool?.name||'Selected item'};
  const result=addCreationControl(base,kind,id);setPendingAddition({creation,controls:creationControls(result.project,creation),newTool});
 }
 function confirmButtons(choices:{action:string;label:string}[]){if(!pendingAddition)return;const {creation,newTool}=pendingAddition;const result=addReviewedButtons(currentProject.current,creation.kind,creation.id,choices,newTool);save(result.project);setActiveCreation(creation);setStep(2);setTesting(false);setSelection({kind:'control',id:result.controlId});setPendingAddition(null);if(result.project.gameTools.some(t=>t.type==='youtube'&&t.id===creation.id))onOpenYoutube();}
 function applyBackground(id:string,board=false){onChange({...project,assets:project.assets.map(a=>({...a,inProject:board?(a.role==='background'?false:a.inProject):(key(a)===id?true:a.role==='background'?false:a.inProject),role:!board&&key(a)===id?'background':a.role})),gameTools:project.gameTools.map(t=>(t.type==='blank-board'||t.type==='trivia-board')?{...t,inOverlayBuild:board&&t.id===id,config:{...t.config,triggerOnly:false}}:t)});}
 function drop(e:React.DragEvent){e.preventDefault();try{const item=JSON.parse(e.dataTransfer.getData('application/ttc-creation'));if(['asset','tool','composition'].includes(item.kind))reviewCreation(item.kind,item.id);}catch{}}

 return <section ref={assemblyRef} className={"build-space build-space-compact"+(testing?" build-space-testing":"")} aria-label="Build Space assembly">
  <header className="build-space-toolbar"><div><h2>Assemble & rehearse</h2><p>{testing?"Try your buttons and watch the overlay beside them.":"Choose an item, adjust it, and test it here."}</p></div><div className="build-workspace-actions"><button type="button" onClick={onWorkshop}>Workshop</button>{onAskAi&&<button type="button" onClick={onAskAi}>Ask Jewel</button>}<button type="button" className="build-btn" aria-pressed={testing} onClick={()=>{setActiveCreation(null);goStep(testing?2:3);}}>{testing?"Return to assembly":"Test dashboard & overlay"}</button></div></header>
  <div className="build-local-navigation"><span className="workflow-section-label">Build Space tasks · edit in any order</span><nav className="build-steps" aria-label="Build Space tasks">{['Background','Add items','Customize','Test','Review'].map((label,index)=><button type="button" key={label} aria-pressed={step===index} onClick={()=>{if(index===3)setActiveCreation(null);goStep(index);}}>{label}</button>)}</nav></div>
  {sequenceRunning&&<button type="button" onClick={onStopSequence}>Stop sequence</button>}<div role="status" aria-live="polite">{sequenceError||feedback}</div>
  <div className="build-work-area">
  <aside className="build-inspector" aria-label="Items and editing">
  <details className="build-guidance" aria-label="Current build step"><summary>Help for this task</summary><h3>{['Set your initial background','Choose the next addition','Choose how this addition looks and works','Play a complete round','Review before publishing'][step]}</h3><p>{['Choose a still image, animated background, or a board designed in Workshop. This is the starting scene.','Choose something you made in Workshop. You’ll choose and name its dashboard buttons before adding them. You’ll then choose how it looks and try it. It stays hidden until you press its button.','The selected result is shown here only as an editing preview. Adjust its appearance and placement, name its controls, then test them.','Use the dashboard to show, reveal, play, and hide your additions. The background starts with the scene; game actions start only when you trigger them.','Fix missing connections and check a complete round before publishing.'][step]}</p>{showNextGuidance&&step<4&&step!==1&&step!==2&&<button type="button" disabled={step===0&&!hasBackground} onClick={()=>goStep(step+1)}>Next: {['Choose additions','Set up this addition','Rehearse','Ready to publish'][step]}</button>}</details>
  {step===0&&<BackgroundBrowser project={project} onChoose={applyBackground} onWorkshop={onWorkshop}/>}
    {step===4&&<section className="build-readiness" aria-label="Game readiness"><h3>{issues.length?`${issues.length} connection issues to fix`:'No connection issues detected'}</h3>{issues.length?issues.map(issue=><div key={issue.id}><p>{issue.message}</p><button type="button" onClick={()=>{goStep(2);setSelection({kind:issue.kind,id:issue.targetId});}}>Fix connection</button></div>):<p>Check your game's rules, media playback, and complete round in rehearsal before publishing.</p>}<button type="button" onClick={()=>goStep(3)}>Rehearse game</button><button type="button" disabled={issues.length>0} onClick={onPublishStep}>Continue to Publish</button></section>}
  {!testing&&(step===1||step===2&&!selection)&&<section className="addition-guide" aria-label="Additions guide">

   <label className="build-item-type">What would you like to add?<select aria-label="Addition type" value={additionType} onChange={e=>{const v=e.target.value as AdditionType;setAdditionType(v);setLibraryFamily(v==="image"?"pictures":v==="video"?"video":v==="audio"?"music":"features");setStep(1);setSelection(null);setActiveCreation(null);}}>{additionTypes.map(item=><option key={item.id} value={item.id}>{item.label} · {creations[item.id].length} available</option>)}</select></label>
   <h4>{guide.label}</h4><p>{guide.help}</p>

   {!pendingAddition&&(step===1||!selection)&&<p className="build-library-pointer">Pick from the <strong>Library</strong> beside the stage — everything you made in the Workshop is there, organized and ready to add in.</p>}
   {!pendingAddition&&!['image','video','audio','composition','question-card','blank-card'].includes(additionType)&&<button type="button" onClick={()=>{const id=crypto.randomUUID(),t:GameTool={id,type:additionType as GameTool['type'],name:guide.label,enabled:true,inToolbox:true,config:toolDefaults(additionType as GameTool['type'])};reviewCreation('tool',id,t);}}>{additionType==='youtube'?'Add YouTube search to dashboard':`Create ${guide.label.toLowerCase()}`}</button>}
   {pendingAddition&&<DashboardButtonReview key={pendingAddition.creation.id} name={pendingAddition.creation.name} controls={pendingAddition.controls} existingIds={new Set(project.controls.map(c=>c.id))} onAdd={confirmButtons} onCancel={()=>setPendingAddition(null)}/> }
   {step===2&&activeCreation&&<section aria-label="Connected dashboard buttons"><h4>{activeCreation.name}</h4><p>The controls are connected. Choose a button to customize its name, look, or overlay result.</p><div className="placed-items">{connected.filter(c=>!c.sequenceOnly).map(c=><button type="button" key={c.id} aria-pressed={control?.id===c.id} onClick={()=>setSelection({kind:'control',id:c.id})}>{c.label}</button>)}</div></section>}
   <div className="addition-actions"><button type="button" onClick={onWorkshop}>Create in Workshop</button>{step===2&&<><button type="button" onClick={()=>goStep(3)}>Test this addition</button><button type="button" onClick={()=>{setStep(1);setSelection(null);}}>Add another {guide.label.toLowerCase()}</button></>}<button type="button" onClick={nextType}>Finish adding — test dashboard</button><button type="button" onClick={()=>{setActiveCreation(null);goStep(3);}}>Review the whole game</button></div>
   <p>Boards are backgrounds. Question pools are selected inside the card setup.</p>
  </section>}
  {testing&&activeCreation&&<section className="build-guidance" aria-label="Test this addition"><h3>Test {activeCreation.name}</h3><p>Use its controls below. Check the result appears only when requested, looks right, and can be cleared or stopped.</p><div className="placed-items">{connected.filter(c=>!c.sequenceOnly).map(c=><button type="button" key={c.id} style={controlButtonStyle(c)} onClick={()=>onTrigger(c)}>{controlLabel(project,c,cardStates)}</button>)}<button type="button" onClick={()=>{setTesting(false);setStep(2);setSelection(connected[0]?{kind:'control',id:connected[0].id}:null);}}>Adjust this addition</button><button type="button" onClick={nextType}>Finish adding — test dashboard</button></div></section>}
  {!testing&&selection&&<section ref={settings} className="assembly-settings" aria-label="Selected item settings"><h3>Set up: {tool?.type==='youtube'?'YouTube search':asset?.name||tool?.name||control?.label}</h3>
   {asset&&<><button type="button" onClick={onWorkshop}>Edit or upload in Workshop</button>{mediaKind(asset)!=="audio"&&<section className="build-media-fit" aria-label="Media fit"><h4>Fit to 1920 × 1080 overlay</h4><p>Show the whole image or video, or fill the frame with cropped edges.</p><button type="button" onClick={()=>updateAsset(key(asset),{edits:{...asset.edits,fit:"contain",placement:{x:0,y:0,width:100,height:100},zoom:1,rotation:0,offsetX:0,offsetY:0}})}>Show full media</button><button type="button" onClick={()=>updateAsset(key(asset),{edits:{...asset.edits,fit:"cover",placement:{x:0,y:0,width:100,height:100},zoom:1,rotation:0,offsetX:0,offsetY:0}})}>Fill overlay</button><label>Fit inside its placed frame<select value={asset.edits?.fit||"contain"} onChange={e=>updateAsset(key(asset),{edits:{...asset.edits,fit:e.target.value as "contain"|"cover"}})}><option value="contain">Show full media · no cropping</option><option value="cover">Fill frame · crop edges</option>{asset.edits?.fit==="fill"&&<option value="fill">Existing stretched fit</option>}</select></label></section>}<p>{mediaKind(asset)==="audio"?"Audio playback":asset.role==="background"&&asset.inProject?"Initial background":"Shown by its dashboard control"}</p>{(asset.type.includes("video")||asset.type.includes("audio"))&&<><label>Repeat this media<input type="checkbox" checked={asset.edits?.loop??false} onChange={e=>updateAsset(key(asset),{edits:{...asset.edits,loop:e.target.checked}})}/></label><label>Play sound<input type="checkbox" checked={asset.edits?.sound??["audio","video"].includes(mediaKind(asset))} onChange={e=>updateAsset(key(asset),{edits:{...asset.edits,sound:e.target.checked}})}/></label><label>Volume<input type="range" min="0" max="100" value={asset.edits?.volume??80} onChange={e=>updateAsset(key(asset),{edits:{...asset.edits,volume:+e.target.value}})}/></label></>}{asset.inProject&&<button type="button" onClick={()=>{updateAsset(key(asset),{inProject:false});setSelection(null);}}>Remove from overlay</button>}</>}
   {tool&&(tool.type==="question-card"||tool.type==="blank-card")&&<QuestionCardEditor key={`card-editor:${tool.id}`} project={project} tool={tool} onSave={saveTool}/>}
   {tool?.type==="question-card"&&<button type="button" onClick={()=>reviewCreation('tool',tool.id)}>Connect cards and Show / Reveal controls</button>}

   {tool?.type==='countdown'&&<CountdownDuration key={`timer-duration:${tool.id}`} seconds={Number(tool.config.seconds)||10} onSave={seconds=>onChange({...project,gameTools:project.gameTools.map(item=>item.id===tool.id?{...item,config:{...item.config,seconds}}:item)})}/>}
   {tool?.type==="random-picker"&&<p>Choose a card list or image pool below. One button randomly draws an unused item, then removes it. Start new game resets the history only when the host confirms.</p>}{tool&&!["question-card","blank-card","youtube","blank-board","trivia-board"].includes(tool.type)&&<GameToolEditor expanded showDuration={tool.type!=="countdown"} key={`tool-editor:${tool.id}`} project={project} tool={tool} assets={project.assets} onSave={saveTool} onRegisterAsset={asset=>onChange({...project,assets:[...(project.assets||[]),asset],updatedAt:"just now"})}/>}
   {tool&&<><p>{tool.type==="youtube"?"YouTube search is added to your host dashboard. Press Open YouTube search during rehearsal or a live game to find and choose a video. The search panel stays private. Only the video appears on the overlay when you send it. No YouTube search box is added to the overlay. Choose Adjust video position below only when you want to set where a chosen video will play.":"This result waits for its dashboard control during play."}</p>{tool.type==='youtube'?<><button type="button" onClick={()=>{const search=project.controls.find(c=>c.action===`tool.${tool.id}`);if(search)onOpenYoutube();}}>Open private YouTube search</button><button type="button" aria-pressed={positionYoutube} onClick={()=>setPositionYoutube(value=>!value)}>{positionYoutube?'Hide video position guide':'Adjust video position'}</button></>:<button type="button" onClick={()=>{onChange({...project,gameTools:project.gameTools.map(t=>t.id===tool.id?{...t,inOverlayBuild:false}:t)});setSelection(null);}}>Remove from overlay</button>}</>}
   {tool?.type==='blank-card'&&<label>Text shown by this card button<textarea value={String(tool.config.text||'')} onChange={e=>onChange({...project,gameTools:project.gameTools.map(t=>t.id===tool.id?{...t,config:{...t.config,text:e.target.value}}:t)})}/></label>}
   {control?.action.startsWith('coin.cycle.')&&<section className="build-sequence-summary" aria-label="Coin button press cycle"><h4>One button · one action per press</h4><ol><li>First press: show the coin, ready to flip.</li><li>Second press: flip the coin and reveal Heads or Tails.</li><li>Third press: remove the coin.</li></ol><p>The next press starts again. Each step waits for the host.</p><button type="button" onClick={()=>{setActiveCreation(null);setTesting(true);setStep(3);}}>Test dashboard &amp; overlay</button></section>}
   {control?.action==='sequence'&&<section className="build-sequence-summary" aria-label="Connected sequence steps"><h4>Actions connected to this button</h4><p>{control.sequenceMode==='per-press'?'Each press performs the next action below. After the last step, the next press returns to the first.':'One press runs these actions in order in Test or during the game.'}</p><ol>{(control.chain||[]).map(step=><li key={step.id}>{project.controls.find(item=>item.id===step.refId)?.label||step.label}{step.timing.mode==='delay'&&Number(step.timing.seconds)>0?` · wait ${step.timing.seconds} seconds before this step`:''}</li>)}</ol><button type="button" onClick={()=>{setActiveCreation(null);setTesting(true);setStep(3);}}>Test dashboard &amp; overlay</button></section>}
   {control&&<><label>Button name on your dashboard<input value={control.label} onChange={e=>updateControl(control.id,{label:e.target.value})}/></label><details className="build-advanced"><summary>Button colors and font</summary><label>Button color<input type="color" value={control.appearance?.backgroundColor||'#15243a'} onChange={e=>updateControl(control.id,{appearance:{...control.appearance,backgroundColor:e.target.value}})}/></label><label>Text color<input type="color" value={control.appearance?.color||'#ffffff'} onChange={e=>updateControl(control.id,{appearance:{...control.appearance,color:e.target.value}})}/></label><FontPicker value={control.appearance?.fontFamily||'Arial, sans-serif'} onChange={fontFamily=>updateControl(control.id,{appearance:{...control.appearance,fontFamily}})}/></details><p><strong>What this button does:</strong> {control.detail}</p><details className="build-setting-group" open={control.action!=='sequence'}><summary>One function</summary><DashboardActionPicker key={control.id+':'+control.action} project={project} control={control} onApply={(action,detail)=>{const current=currentProject.current,next=assignControlAction(current,control,action),composition=current.compositions?.find(c=>action===`composition.play.${c.id}`);save({...current,gameTools:current.gameTools.map(t=>next.toolIds?.includes(t.id)?{...t,inToolbox:true,inOverlayBuild:t.type==='youtube'?false:true}:t),compositions:current.compositions?.map(c=>c.id===composition?.id?{...c,inProject:true}:c),controls:current.controls.map(c=>c.id===control.id?{...next,detail,buttonMode:'single',sequenceMode:undefined,chain:undefined}:c)});}}/></details><details className="build-setting-group" open={control.action==='sequence'}><summary>Multiple functions</summary><DashboardSequenceEditor key={control.id+JSON.stringify(control.chain)+control.sequenceMode} project={project} control={control} onSave={(patch,actions)=>{const current=currentProject.current,ids=new Set(actions.flatMap(c=>c.toolIds||[]));save({...current,gameTools:current.gameTools.map(t=>ids.has(t.id)?{...t,inToolbox:true,inOverlayBuild:t.type==='youtube'?false:true,config:{...t.config,triggerOnly:true}}:t),compositions:current.compositions?.map(c=>actions.some(a=>a.compositionId===c.id)?{...c,inProject:true}:c),controls:[...current.controls.map(c=>c.id===control.id?{...c,...patch}:c),...actions]});}}/></details><p>During a game, the host presses this saved button. Use rehearsal to check its result and the matching clear or stop button.</p><button type="button" onClick={()=>{onChange({...project,controls:project.controls.filter(c=>c.id!==control.id)});setSelection(null);}}>Remove from dashboard</button></>}
  </section>}
  {testing&&<section className="build-test-help"><h3>Test your game</h3><p>Press a dashboard button and check the result in the overlay. Private search and host tools stay in the dashboard.</p><button type="button" onClick={()=>goStep(2)}>Back to editing</button><button type="button" onClick={()=>goStep(4)}>Review before publishing</button></section>}
  {!testing&&step===2&&!selection&&<p>Select a dashboard button or placed item to edit it here.</p>}
  </aside>
  <div className="paired-canvases build-stage-column">
   <div className="build-stage-area">
    <div className="build-stage-toggle" role="tablist" aria-label="Preview side"><button type="button" role="tab" aria-selected={stageSide==="overlay"} className={stageSide==="overlay"?"active":""} onClick={()=>setStageSide("overlay")}>Overlay preview</button><button type="button" role="tab" aria-selected={stageSide==="dashboard"} className={stageSide==="dashboard"?"active":""} onClick={()=>setStageSide("dashboard")}>Dashboard preview</button></div>
   <section className="assembly-canvas" style={{display:stageSide==="overlay"?undefined:"none"}}><h3>Draft overlay{testing?" preview":""}</h3><div className="stage" ><BuildOverlayPreview>{overlay}{!testing&&tool&&!control&&!(infoTypes.includes(tool.type)&&cardStates[tool.id]&&!cardStates[tool.id].cleared)&&!['question-card','blank-card','card-list','youtube','random-picker'].includes(tool.type)&&<ControlAppearancePreview state={cardStates[tool.id]} control={{id:'editing-'+tool.id,label:tool.name,detail:'Editing preview',action:`tool.${tool.id}`,toolIds:[tool.id],overlayResult:{...defaultOverlayResult,...(tool.config.placement as Partial<typeof defaultOverlayResult>||{})}}} project={project}/>}{!testing&&control&&hasVisualResult&&!(tool&&infoTypes.includes(tool.type)&&cardStates[tool.id]&&!cardStates[tool.id].cleared)&&(!cardControl(control.action)||!!tool&&infoTypes.includes(tool.type))&&<ControlAppearancePreview state={tool?cardStates[tool.id]:undefined} control={{...control,overlayResult:control.overlayResult||defaultOverlayResult}} project={project}/>}
    </BuildOverlayPreview>
    {!testing&&!project.assets.some(a=>a.inProject)&&!project.gameTools.some(t=>t.inOverlayBuild)&&!project.controls.length&&<p className="canvas-empty">Start with a background, or add an item first — either order works. Everything you add appears here through its dashboard buttons.</p>}
    {!testing&&!project.assets.some(a=>a.inProject)&&!project.gameTools.some(t=>t.inOverlayBuild)&&project.controls.length>0&&<p className="canvas-empty">Your buttons are ready — items appear here when you press them in Test. A background is optional; add one anytime from Background.</p>}
    {!testing&&asset?.inProject&&!asset.type.includes("audio")&&<YouTubePlacementEditor key={key(asset)} label={asset.name} placement={asset.edits?.placement||(asset.role==="background"?{x:0,y:0,width:100,height:100}:{x:5,y:20,width:40,height:40})} onChange={placement=>updateAsset(key(asset),{edits:{...asset.edits,placement}})}/>}
    {!testing&&tool&&(!control||tool.type==="youtube")&&(tool.type==='youtube'?positionYoutube:tool.inOverlayBuild)&&tool.type!=="question-card"&&tool.type!=="blank-card"&&(tool.type!=="random-picker"||tool.config.source==="images")&&<YouTubePlacementEditor key={tool.id} label={tool.type==="youtube"?"Video position (editing only)":tool.name} placement={tool.config.placement as {x:number;y:number;width:number;height:number}||{x:15,y:15,width:70,height:70}} onChange={placement=>saveTool({...currentProject.current.gameTools.find(t=>t.id===tool.id)!,config:{...currentProject.current.gameTools.find(t=>t.id===tool.id)!.config,placement}})}/>}
    {!testing&&control&&hasVisualResult&&!cardControl(control.action)&&!control.action.startsWith("background.show.")&&!control.toolIds?.some(id=>project.gameTools.find(t=>t.id===id)?.type==="youtube")&&<YouTubePlacementEditor key={control.id} label={control.label} placement={control.overlayResult||defaultOverlayResult} onChange={placement=>updateControl(control.id,{overlayResult:{...(control.overlayResult||defaultOverlayResult),...placement}})}/>}
   </div>{!testing&&<div className="placed-items" aria-label="Placed overlay items">{project.assets.filter(a=>a.inProject).map(a=><button key={key(a)} type="button" onClick={()=>(setStep(2),setSelection({kind:"asset",id:key(a)}))}>{a.name}</button>)}{project.gameTools.filter(t=>t.inOverlayBuild).map(t=><button key={t.id} type="button" onClick={()=>(setStep(2),setSelection({kind:"tool",id:t.id}))}>{t.type==="youtube"?"Video destination":t.name}</button>)}</div>}</section>
   <section className="assembly-canvas" style={{display:stageSide==="dashboard"?undefined:"none"}}><h3>Host dashboard{testing?" preview":""}</h3>{onResetGame&&<div className="build-reset-row">{!resetConfirm?<button type="button" onClick={()=>setResetConfirm(true)}>Reset game</button>:<div role="alert" className="build-reset-confirm"><p>Reset the whole game to its opening? Everything showing will clear, and every tool goes back to its starting state.</p><label><input type="checkbox" checked={resetWipe} onChange={event=>setResetWipe(event.target.checked)}/> Also put the wheel categories back to how the game was built</label><div className="build-reset-actions"><button type="button" onClick={()=>{setResetConfirm(false);onResetGame(resetWipe);}}>Yes, reset game</button><button type="button" onClick={()=>setResetConfirm(false)}>Keep playing</button></div></div>}</div>}<div className="dashboard-canvas" onDragOver={e=>e.preventDefault()} onDrop={drop}>
    {!project.controls.length&&!dashboardExtras&&<p className="canvas-empty">Place your host controls here.</p>}
    <div className="dashboard-preview-buttons">{project.controls.filter(c=>!c.sequenceOnly).map(c=><button type="button" key={c.id} style={controlButtonStyle(c)} aria-pressed={!testing&&control?.id===c.id} onClick={()=>{const opensYoutube=project.gameTools.some(t=>t.enabled&&t.type==='youtube'&&(c.toolIds?.includes(t.id)||c.action===`tool.${t.id}`));if(testing){onTrigger(c);if(!opensYoutube)setStageSide("overlay");return;}setStep(2);setSelection({kind:"control",id:c.id});if(opensYoutube)onOpenYoutube();}}>{testing?controlLabel(project,c,cardStates):c.label}<small>{c.detail||"Choose an action"}</small></button>)}</div>
    {(testing||tool?.type==='scoreboard')&&dashboardExtras?.(testing?(activeCreation?.kind==="tool"?activeCreation.id:activeCreation?"media-only":undefined):tool?.id)}
    {testing&&project.gameTools.filter(t=>t.enabled&&t.inToolbox&&t.type==="wheel"&&(!activeCreation||activeCreation.id===t.id)).map(t=><WheelHostPanel key={t.id} tool={t} onSave={segments=>onChange({...project,gameTools:project.gameTools.map(x=>x.id===t.id?{...x,config:{...x.config,segments}}:x)})}/>)}
    {youtubeOpen&&youtube&&<div className="youtube-draft-testing"><button type="button" className="outline-btn" onClick={onCloseYoutube}>Close YouTube search</button><p>Private search stays on this dashboard. Choose a video, then send it to the overlay when ready.</p><YouTubeHostPanel canShow={true} onCommand={async(command:Record<string,unknown>)=>{const result=await onYoutubeCommand(command);if(command.action==="play")setStageSide("overlay");return result;}} previewState={youtubeState} previewFeedback={youtubeFeedback} placement={safeYoutubePlacement(youtube.config.placement)}/></div>}
   </div>{!testing&&<p>Choose a button to edit it in the panel beside these previews.</p>}</section>
   </div>
  </div>
   <section className="build-library" aria-label="Library for staging your live">
    <div className="build-library-head"><h3>Library</h3><span>Everything you need while staging — pick it and it goes on the stage.</span></div>
    <div className="build-library-tabs" role="tablist" aria-label="Library sections">{([["pictures","Pictures"],["video","Video"],["music","Music & voice"],["sounds","Sound effects"],["tools","Tools"],["features","Features & scenes"],["templates","Templates"],["effects","Effects"]] as const).map(([id,label])=><button key={id} type="button" role="tab" aria-selected={libraryFamily===id} className={libraryFamily===id?"active":""} onClick={()=>setLibraryFamily(id)}>{label}</button>)}</div>
    <div className="build-library-scroll">
    {libraryFamily==="pictures"&&<div className="library-grid">{creations.image.map(c=>{const connectedCount=creationControls(project,c).length;return <article key={c.id} className="library-tile"><BuildAssetThumbnail asset={assetsByKey.get(c.id)} label={`Set up ${c.name}`} onSelect={()=>pickCreation(c)}/><strong>{c.name}</strong><small>{connectedCount?"Controls connected":"Ready to set up"}</small><button type="button" onClick={()=>pickCreation(c)}>{connectedCount?"Set up this item":"Use this in my game"}</button></article>;})}{!creations.image.length&&<p>No pictures yet — create them in the Workshop.</p>}</div>}
    {libraryFamily==="video"&&<div className="library-grid">{creations.video.map(c=>{const connectedCount=creationControls(project,c).length;return <article key={c.id} className="library-tile"><BuildAssetThumbnail asset={assetsByKey.get(c.id)} label={`Set up ${c.name}`} onSelect={()=>pickCreation(c)}/><strong>{c.name}</strong><small>{connectedCount?"Controls connected":"Ready to set up"}</small><button type="button" onClick={()=>pickCreation(c)}>{connectedCount?"Set up this item":"Use this in my game"}</button></article>;})}{!creations.video.length&&<p>No videos yet — create them in the Workshop.</p>}</div>}
    {libraryFamily==="music"&&<div className="library-grid">{musicCreations.map(c=>{const a=assetsByKey.get(c.id);const connectedCount=creationControls(project,c).length;return <article key={c.id} className="library-tile library-audio-tile"><strong>{c.name}</strong>{a?.url&&<audio controls preload="none" src={a.url} aria-label={`Play ${c.name}`}/>}<small>{connectedCount?"Controls connected":"Ready to set up"}</small><button type="button" onClick={()=>pickCreation(c)}>{connectedCount?"Set up this item":"Use this in my game"}</button></article>;})}{!musicCreations.length&&<p>No music or voice clips yet — create them in the Workshop.</p>}</div>}
    {libraryFamily==="sounds"&&<div className="library-grid">{soundCreations.map(c=>{const a=assetsByKey.get(c.id);const connectedCount=creationControls(project,c).length;return <article key={c.id} className="library-tile library-audio-tile"><strong>{c.name}</strong>{a?.url&&<audio controls preload="none" src={a.url} aria-label={`Play ${c.name}`}/>}<small>{connectedCount?"Controls connected":"Ready to set up"}</small><button type="button" onClick={()=>pickCreation(c)}>{connectedCount?"Set up this item":"Use this in my game"}</button></article>;})}{!soundCreations.length&&<p>No sound effects yet — create them in the Workshop.</p>}</div>}
    {libraryFamily==="tools"&&<div className="library-create-tools"><h4>Create a new tool</h4><div className="library-create-row">{creatableTypes.map(item=><button key={item.id} type="button" onClick={()=>{const id=crypto.randomUUID(),t:GameTool={id,type:item.id as GameTool["type"],name:item.label,enabled:true,inToolbox:true,config:toolDefaults(item.id as GameTool["type"])};setStep(1);setSelection(null);setTesting(false);reviewCreation("tool",id,t);}}>{item.id==="youtube"?"Add YouTube search to dashboard":`Create ${item.label.toLowerCase()}`}</button>)}</div></div>}
    {libraryFamily==="features"&&<div className="library-grid">{featureCreations.map(c=>{const connectedCount=creationControls(project,c).length;const isYoutube=c.kind==="tool"&&project.gameTools.find(t=>t.id===c.id)?.type==="youtube";return <article key={c.kind+c.id} className="library-tile"><strong>{c.name}</strong><small>{connectedCount?"Controls connected":isYoutube?"Private YouTube search panel":"Ready to set up"}</small><button type="button" onClick={()=>pickCreation(c)}>{connectedCount?"Set up this item":isYoutube?"Add YouTube search to dashboard":"Use this in my game"}</button></article>;})}{!featureCreations.length&&<p>No game features yet — create one below.</p>}</div>}
    {libraryFamily==="templates"&&<TemplateBrowser project={project} onChoose={onAddTemplate} ccssEntitled={ccssEntitled}/>}
    {libraryFamily==="effects"&&<div className="library-effects">{canFx?<>
     <p>Effects for the selected button: <strong>{control!.label}</strong></p>
     <h4>Appears with</h4><div className="fx-row">{(["none","fade","slide","zoom"] as const).map(v=><button key={v} type="button" aria-pressed={fxResult.entrance===v} onClick={()=>updateControl(control!.id,{overlayResult:{...fxResult,entrance:v}})}>{v}</button>)}</div>
     <label className="fx-seconds">over <input type="number" min="0" max="5" step="0.1" value={fxResult.entranceSeconds} onChange={e=>updateControl(control!.id,{overlayResult:{...fxResult,entranceSeconds:Math.max(0,Math.min(5,+e.target.value||0))}})}/> seconds</label>
     <h4>Leaves with</h4><div className="fx-row">{(["none","fade","slide","zoom"] as const).map(v=><button key={v} type="button" aria-pressed={fxResult.exit===v} onClick={()=>updateControl(control!.id,{overlayResult:{...fxResult,exit:v}})}>{v}</button>)}</div>
     <label className="fx-seconds">over <input type="number" min="0" max="5" step="0.1" value={fxResult.exitSeconds} onChange={e=>updateControl(control!.id,{overlayResult:{...fxResult,exitSeconds:Math.max(0,Math.min(5,+e.target.value||0))}})}/> seconds</label>
     <div className="fx-actions"><button type="button" onClick={()=>{setStageSide("overlay");onTrigger(control!);}}>See it on the overlay</button></div>
    </>:<p>Select a button on the Dashboard preview, then pick how it appears and leaves here. Effects apply to picture, video and scene buttons.</p>}</div>}
    </div>
   </section>
  </div>
 </section>;
}

