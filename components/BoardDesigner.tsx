"use client";
import FontPicker from './FontPicker';
import {resolveFont} from '../lib/fonts';
import {useEditableTool} from "./useEditableTool";
import {useState} from 'react';
import type {GameTool,Project} from '../lib/project';
import {mediaKind} from '../lib/board-design';
import './board-designer.css';

export function BoardArtwork({tool,project,playing=false}:{tool:GameTool;project:Pick<Project,'assets'>;playing?:boolean}){
 const appearance=(tool.config.appearance||{}) as Record<string,unknown>;
 const asset=project.assets.find(a=>(a.storageKey||a.name)===(tool.config.backgroundAssetKey||appearance.imageKey));
 const motion=['pulse','float'].includes(String(tool.config.backgroundMotion))?String(tool.config.backgroundMotion):'none';
 return <div className={'board-artwork board-motion-'+motion} style={{background:appearance.transparentBackground===true?'transparent':String(appearance.backgroundColor||'#101827')}}>{appearance.transparentBackground!==true&&asset?.url&&(mediaKind(asset)==='video'?<video aria-label={asset.name} src={asset.url} autoPlay={playing} muted loop={tool.config.backgroundLoop!==false} playsInline preload={playing?"auto":"metadata"}/>:<img src={asset.url} alt={asset.name}/>)}</div>;
}
export function BoardSurface({tool,project,playing=false}:{tool:GameTool;project:Pick<Project,'assets'>;playing?:boolean}){
 const appearance=(tool.config.appearance||{}) as Record<string,unknown>;
 return <div className="board-surface" style={{color:String(appearance.textColor||'#fff'),fontFamily:resolveFont(appearance.fontFamily)}}><BoardArtwork tool={tool} project={project} playing={playing}/>{tool.config.showTitle===true&&<h3 className="board-title">{String(tool.config.title||tool.name)}</h3>}</div>;
}
export default function BoardDesigner({project,tool,onSave,onClose,onCreateArtwork}:{project:Project;tool:GameTool;onSave:(tool:GameTool)=>void;onClose:()=>void;onCreateArtwork:()=>void}){
 const {draft,commit,patchConfig,patchAppearance,patchTool}=useEditableTool(tool,onSave);
 const [saved,setSaved]=useState(false),[preview,setPreview]=useState(true);
 const appearance=(draft.config.appearance||{}) as Record<string,unknown>;
 const patch=(values:Record<string,unknown>)=>{patchConfig(values);setSaved(true);};
 const media=project.assets.filter(a=>a.url&&['image','video'].includes(mediaKind(a)));
 return <section className="board-designer" aria-label="Workshop board designer">
 <header><div><small>WORKSHOP · BOARD DESIGNER</small><h2>Design your game board</h2><p>The board becomes your initial overlay background. Create your own artwork and layout here; connect game actions in Build Space.</p></div><button type="button" className="outline-btn" onClick={onClose}>Close</button></header>
 <div className="board-designer-grid">
  <div className="board-designer-preview">{preview&&<BoardSurface tool={draft} project={project} playing={false}/><label className="board-preview-toggle"><input type="checkbox" checked={preview} onChange={e=>setPreview(e.target.checked)}/> Show preview</label></div>
  <div className="board-designer-controls">
   <label>Title<input value={String(draft.config.title||draft.name)} onChange={e=>patch({title:e.target.value})}/></label>
   <label><input type="checkbox" checked={draft.config.showTitle===true} onChange={e=>patch({showTitle:e.target.checked})}/> Show title on board</label>
   <label>Background color<input type="color" value={String(appearance.backgroundColor||'#101827')} onChange={e=>patchAppearance({backgroundColor:e.target.value})}/></label>
   <label>Text color<input type="color" value={String(appearance.textColor||'#ffffff')} onChange={e=>patchAppearance({textColor:e.target.value})}/></label>
   <FontPicker value={String(appearance.fontFamily||'')} onChange={fontFamily=>patchAppearance({fontFamily})}/>
   <label>Board artwork<select value={String(draft.config.backgroundAssetKey||'')} onChange={e=>patch({backgroundAssetKey:e.target.value||undefined})}><option value="">None</option>{media.map(a=><option key={a.storageKey||a.name} value={a.storageKey||a.name}>{a.name}</option>)}</select></label>
   <button type="button" className="outline-btn" onClick={onCreateArtwork}>Generate board artwork</button>
   <label>Motion<select value={String(draft.config.backgroundMotion||'none')} onChange={e=>patch({backgroundMotion:e.target.value})}><option value="none">None</option><option value="pulse">Pulse</option><option value="float">Float</option></select></label>
   <label><input type="checkbox" checked={draft.config.backgroundLoop!==false} onChange={e=>patch({backgroundLoop:e.target.checked})}/> Loop video background when playing live</label>
   <button type="button" className="build-btn" onClick={()=>{commit();setSaved(true);}}>Save board</button>
   {saved&&<p role="status">Board saved to your draft.</p>}
  </div>
 </div>
 </section>;
}
