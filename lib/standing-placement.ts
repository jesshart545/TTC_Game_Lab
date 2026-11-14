import type {GameTool,Project} from './project';

/**
 * Default placements for standing game tools (the 2026-11-14 live
 * recheck defect): a placed tool's overlay position lives in
 * tool.config.placement ({x,y,width,height}, percent of the
 * 1920x1080 canvas), but the four chance games' defaults carry no
 * placement and neither creation path assigned one — so
 * overlayToolPlacement returned {} and the .runtime-game-tool CSS
 * class centered every standing tool at left:50% / top:50%, stacking
 * a whole set of placed games on the identical central spot.
 *
 * When a build edit leaves a standing tool placed WITHOUT a
 * placement, it is assigned the next free slot here: deterministic,
 * in saved tool order, first the center (the spot a lone standing
 * game has always occupied), then the four quadrants, skipping any
 * slot an already-placed tool's placement substantially covers. A
 * placement the creator or Jewel stated — even a partial one — is
 * respected: a partial statement is completed from the slot, never
 * replaced. Tools that already carry a full placement, and saved
 * projects this pass never runs on, are untouched.
 */

export type PlacementRect={x:number;y:number;width:number;height:number};

/** The standing types rendered through the shared placed-tool
 *  wrapper (toolStyle + overlayToolPlacement): the four chance games
 *  and the random picker. Countdown and the gift guide position
 *  themselves from their own built-in defaults, so they are not
 *  slotted. */
export const standingPlacementTypes=['plinko','higher-lower','cliffhanger','prize-wheel','random-picker'];

/** Deterministic slots, percent of the canvas: center first, then
 *  the four quadrants (top-left, top-right, bottom-left,
 *  bottom-right). The quadrants are mutually disjoint, and the
 *  center overlaps each quadrant by under a fifth of its area, so
 *  taking the center never blocks a quadrant (the slot-free rule
 *  below) and vice versa. */
export const standingSlots:PlacementRect[]=[
 {x:27,y:27,width:46,height:46},
 {x:1,y:1,width:46,height:44},
 {x:53,y:1,width:46,height:44},
 {x:1,y:55,width:46,height:44},
 {x:53,y:55,width:46,height:44},
];

const finite=(v:unknown):number|undefined=>typeof v==='number'&&Number.isFinite(v)?v:undefined;

/** The tool's full saved placement rect, or null when it has none
 *  (absent, or only partially stated). */
export function standingPlacementOf(tool:GameTool):PlacementRect|null{
 const p=tool.config?.placement as Partial<PlacementRect>|undefined;
 if(!p||typeof p!=='object'||Array.isArray(p))return null;
 const x=finite(p.x),y=finite(p.y),width=finite(p.width),height=finite(p.height);
 if(x===undefined||y===undefined||width===undefined||height===undefined)return null;
 return {x,y,width,height};
}

function partialPlacementOf(tool:GameTool):Partial<PlacementRect>{
 const p=tool.config?.placement as Partial<PlacementRect>|undefined;
 if(!p||typeof p!=='object'||Array.isArray(p))return {};
 const out:Partial<PlacementRect>={};
 for(const key of ['x','y','width','height'] as const){const n=finite(p[key]);if(n!==undefined)out[key]=n;}
 return out;
}

/** Mirrors standsOnOverlay (components/StandingToolFace) for the
 *  slotted types: enabled, placed on the overlay build, and — for
 *  the chance games — not trigger-only. The random picker stands
 *  regardless of triggerOnly, as it does on the overlay. Exported
 *  for surfaces that must decide standing without importing the
 *  client component module (Set the Stage's drag set). */
export function standsPlaced(tool:GameTool):boolean{
 if(!standingPlacementTypes.includes(tool.type)||!tool.enabled||!tool.inOverlayBuild)return false;
 if(tool.type==='random-picker')return true;
 return !tool.config?.triggerOnly;
}

function overlapArea(a:PlacementRect,b:PlacementRect):number{
 const w=Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x);
 const h=Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y);
 return w>0&&h>0?w*h:0;
}

/** A slot counts as taken when an occupied rect covers more than a
 *  fifth of it — two standing games may share an edge, never a home. */
function slotFree(slot:PlacementRect,occupied:PlacementRect[]):boolean{
 return occupied.every(rect=>overlapArea(slot,rect)<=0.2*slot.width*slot.height);
}

export function assignStandingPlacements(project:Project):Project{
 const tools=project.gameTools||[];
 const occupied:PlacementRect[]=[];
 for(const tool of tools){
  if(!tool.enabled||!tool.inOverlayBuild)continue;
  const rect=standingPlacementOf(tool);
  if(rect)occupied.push(rect);
 }
 const assigned=new Map<string,PlacementRect>();
 for(const tool of tools){
  if(!standsPlaced(tool)||standingPlacementOf(tool))continue;
  const stated=partialPlacementOf(tool);
  let slot=standingSlots.find(candidate=>slotFree(candidate,occupied));
  if(!slot){
   // Every slot is covered: cascade deterministically off the slot
   // sequence, nudged inward per lap so the tool stays on canvas.
   const base=standingSlots[occupied.length%standingSlots.length];
   const lap=Math.floor(occupied.length/standingSlots.length);
   const shift=Math.min(3*lap,100-base.x-base.width,100-base.y-base.height);
   slot={...base,x:base.x+Math.max(0,shift),y:base.y+Math.max(0,shift)};
  }
  const rect:PlacementRect={...slot,...stated};
  assigned.set(tool.id,rect);
  occupied.push(rect);
 }
 if(!assigned.size)return project;
 return {...project,gameTools:tools.map(tool=>assigned.has(tool.id)?{...tool,config:{...tool.config,placement:assigned.get(tool.id)}}:tool)};
}
