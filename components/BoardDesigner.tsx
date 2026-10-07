"use client";
import {useState} from 'react';
import type {GameTool,Project} from '../lib/project';
import {mediaKind} from '../lib/board-design';
import './board-designer.css';

export function BoardArtwork({tool,project}:{tool:GameTool;project:Pick<Project,'assets'>}){
 const appearance=(tool.config.appearance||{}) as Record<string,unknown>;
 const asset=project.assets.find(a=>(a.storageKey||a.name)===(tool.config.backgroundAssetKey||appearance.imageKey));
 const motion=['pulse','float'].includes(String(tool.config.backgroundMotion))?String(tool.config.backgroundMotion):'none';
 return <div className={'board-artwork board-motion-'+motion} style={{background:String(appearance.backgroundColor||'#101827')}}>{asset?.url&&(mediaKind(asset)==='video'?<video aria-label={asset.name} src={asset.url} autoPlay muted loop={tool.config.backgroundLoop!==false} playsInline/>:<img src={asset.url} alt={asset.name}/>)}</div>;
}
export function BoardSurface({tool,project}:{tool:GameTool;project:Pick<Project,'assets'>}){
 const appearance=(tool.config.appearance||{}) as Record<string,unknown>;
 return <div className="board-surface" style={{color:String(appearance.textColor||'#fff')}}><BoardArtwork tool={tool} project={project}/>{tool.config.showTitle===true&&<h3 className="board-title">{String(tool.config.title||tool.name)}</h3>}</div>;
}
export default function BoardDesigner({project,tool,onSave,onClose,onCreateArtwork}:{project:Project;tool:GameTool;onSave:(tool:GameTool)=>void;onClose:()=>void;onCreateArtwork:()=>void}){
 const [draft,setDraft]=useState<GameTool>(()=>({...tool,config:{...tool.config}}));
 const [saved,setSaved]=useState(false),[preview,setPreview]=useState(true);
 const appearance=(draft.config.appearance||{}) as Record<string,unknown>;
 const patch=(values:Record<string,unknown>)=>{setSaved(false);setDraft(p=>({...p,config:{...p.config,...values}}));};
 const media=project.assets.filter(a=>a.url&&['image','video'].includes(mediaKind(a)));
 return <section className="board-designer" aria-label="Workshop board designer">
 <header><div><small>WORKSHOP · BOARD DESIGNER</small><h2>Design your game board</h2><p>The board becomes your initial overlay background. Create your own artwork and layout here; connect game actions in Build Space.</p></div><button type="button" onClick={onClose}>Back to Workshop</button></header>
 <div className="board-designer-layout"><aside>
 <label>Board name<input value={draft.name} onChange={e=>{setSaved(false);setDraft({...draft,name:e.target.value});}}/></label>
 <label>Board heading<input value={String(draft.config.title||'')} onChange={e=>patch({title:e.target.value})}/></label>
 <label><input type="checkbox" checked={draft.config.showTitle===true} onChange={e=>patch({showTitle:e.target.checked})}/>Show heading</label>
 <label>Board artwork<select value={String(draft.config.backgroundAssetKey||appearance.imageKey||'')} onChange={e=>patch({backgroundAssetKey:e.target.value,appearance:{...appearance,imageKey:''}})}><option value="">Color only</option>{media.map(a=><option key={a.storageKey||a.name} value={a.storageKey||a.name}>{a.name} · {mediaKind(a)==='video'?'animated video':'image / GIF'}</option>)}</select></label>
 <button type="button" onClick={()=>{onSave(draft);onCreateArtwork();}}>Save board & create artwork</button>
 <label>Background animation<select value={String(draft.config.backgroundMotion||'none')} onChange={e=>patch({backgroundMotion:e.target.value})}><option value="none">Use artwork as supplied</option><option value="pulse">Gentle zoom</option><option value="float">Gentle movement</option></select></label>
 <label><input type="checkbox" checked={draft.config.backgroundLoop!==false} onChange={e=>patch({backgroundLoop:e.target.checked})}/>Loop video background</label>
 <p>Video artwork plays silently as the board background. Animation does not trigger game actions.</p>
 {['backgroundColor','textColor','accentColor'].map((key,i)=><label key={key}>{['Board color','Text color','Accent color'][i]}<input type="color" value={String(appearance[key]||['#101827','#ffffff','#20e8ff'][i])} onChange={e=>patch({appearance:{...appearance,[key]:e.target.value}})}/></label>)}
 </aside><div><button type="button" onClick={()=>setPreview(!preview)}>{preview?'Pause artwork preview':'Play artwork preview'}</button><div className="board-design-canvas" aria-label="Board design canvas">
 {preview?<BoardSurface tool={draft} project={project}/>:<div className="board-preview-paused">Artwork preview paused</div>}
 </div><p>Start with your own artwork, or create new artwork from your description. No game spaces or grid are added to your design.</p>{tool.type==='trivia-board'&&<p>Your saved trivia categories and questions are preserved. This designer edits the board artwork without changing the saved questions.</p>}</div></div>
 <footer><button type="button" onClick={()=>{onSave(draft);setSaved(true);}}>Save board design</button><span role="status">{saved?'Board design saved to draft.':''}</span><p>Save before leaving. Build Space connects dashboard controls to the finished board.</p></footer>
 </section>;
}
