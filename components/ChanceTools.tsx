"use client";
import { useEffect, useState, type CSSProperties } from 'react';
import './chance-tools.css';

// The neutral house board a Plinko shows when it has no artwork of
// its own — and the fallback when its own artwork fails to load.
// Must equal PLINKO_DEFAULT_BOARD_ART in lib/plinko-art (pinned by
// tests/plinko-overlay-board.cjs); kept as a local literal because
// this component is loaded standalone by the render test harnesses.
// It is deliberately NOT the first board Jessica uploaded: she ruled
// her board was not to become the face of every Plinko game.
const PLINKO_HOUSE_BOARD = "/game-art/plinko-board-default.webp";

// The animation presents an already-selected result; it never draws another winner.
export function wheelRotation(winner:number,count:number,progress:number){return (2160-(winner+.5)*360/Math.max(1,count))*(1-Math.pow(1-Math.min(1,Math.max(0,progress)),4));}
// A wheel's OWN artwork (artSrc: the stage backboard Jewel generated
// from the creator's style words at creation time, saved on the tool's
// config as artKey — lib/chance-art) fills the panel BEHIND the wheel:
// the wheel itself — its segments, the creator's colors, the lights,
// the labels — is still drawn by the code above it, unchanged, because
// the artwork never carries labels. Without artSrc the wheel renders
// exactly as it always has.
export function WheelDisplay({entries,result,elapsed=0,duration=4000,preview=false,colors=["#154c69","#512b75"],textColor="#ffffff",artSrc}:{entries:string[];result:string;elapsed?:number;duration?:number;preview?:boolean;colors?:string[];textColor?:string;artSrc?:string}) {
 const winner=Math.max(0,entries.indexOf(result));
 const slice=360/Math.max(1,entries.length);
 const progress=preview?0:Math.min(1,Math.max(0,elapsed/duration));
 const spinning=!preview&&progress<1,landed=!preview&&progress>=1&&entries.length>0;
 const rotation=wheelRotation(winner,entries.length,progress);
 const point=(angle:number)=>[100+92*Math.cos((angle-90)*Math.PI/180),100+92*Math.sin((angle-90)*Math.PI/180)];
 const bulbs=Array.from({length:24},(_,i)=>{const a=i*15*Math.PI/180;return {x:100+96.3*Math.cos(a),y:100+96.3*Math.sin(a),alt:i%2===0};});
 return <div className="chance-tool"><div className={"chance-wheel"+(spinning?" is-spinning":preview?" is-idle":"")} style={artSrc?{backgroundImage:`url("${artSrc}")`,backgroundSize:"cover",backgroundPosition:"center",borderRadius:22}:undefined}><svg viewBox="0 0 200 200" role="img" aria-label={preview?'Wheel design':progress<1?'Wheel spinning':`Wheel landed on ${result}`}>
 <defs>
  <radialGradient id="wheel-rim" cx="50%" cy="42%" r="68%"><stop offset="0%" stopColor="#ffe9a8"/><stop offset="55%" stopColor="#e8a93d"/><stop offset="100%" stopColor="#9a6414"/></radialGradient>
  <radialGradient id="wheel-shade" cx="50%" cy="50%" r="50%"><stop offset="60%" stopColor="#000000" stopOpacity="0"/><stop offset="88%" stopColor="#000000" stopOpacity=".10"/><stop offset="100%" stopColor="#000000" stopOpacity=".30"/></radialGradient>
  <radialGradient id="wheel-hub" cx="38%" cy="30%" r="85%"><stop offset="0%" stopColor="#fff3c4"/><stop offset="55%" stopColor="#f0b93f"/><stop offset="100%" stopColor="#a86e12"/></radialGradient>
  <linearGradient id="wheel-flapper" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ff7a6b"/><stop offset="100%" stopColor="#c21430"/></linearGradient>
 </defs>
 <circle cx="100" cy="100" r="99" fill="url(#wheel-rim)"/>
 <circle cx="100" cy="100" r="98.4" fill="none" stroke="#7a520d" strokeWidth=".8"/>
 <g transform={`rotate(${rotation} 100 100)`}>{entries.map((label,i)=>{const start=point(i*slice),end=point((i+1)*slice),center=(i+.5)*slice;return <g key={i} className={landed&&i===winner?"chance-wheel-win":undefined}>{entries.length===1?<circle cx="100" cy="100" r="92" fill={colors[0]}/>:<path d={`M100 100 L${start.join(' ')} A92 92 0 ${slice>180?1:0} 1 ${end.join(' ')} Z`} fill={colors[i%colors.length]} stroke="white" strokeWidth=".7"/>}<text transform={`rotate(${center} 100 100)`} x="100" y="30" textAnchor="middle" fill={textColor} fontSize={entries.length>16?5:8} fontWeight="700">{label.length>22?label.slice(0,21)+'…':label}</text></g>;})}</g>
 <circle cx="100" cy="100" r="92" fill="url(#wheel-shade)" pointerEvents="none"/>
 {bulbs.map((b,i)=><circle key={i} className={b.alt?"chance-bulb a":"chance-bulb b"} cx={b.x} cy={b.y} r="2.1" fill={b.alt?"#ffd166":"#fff6da"} stroke="#8a5f0e" strokeWidth=".4"/>)}
 <circle cx="100" cy="100" r="15" fill="url(#wheel-hub)" stroke="#7a520d"/>
 <circle cx="100" cy="100" r="6.5" fill="#14213a" stroke="#fff3c4"/>
 <g className="chance-wheel-flapper"><path d="M92 0 L108 0 L100 17 Z" fill="url(#wheel-flapper)" stroke="#ffffff" strokeWidth="1.2"/></g></svg></div>
 {!entries.length?<p role="alert">Add entries in Workshop.</p>:<strong role="status" className="chance-status">{preview?'Ready to spin':progress<1?'Spinning…':result}</strong>}</div>;
}
const pips:Record<number,number[]>={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
// The die's OWN face artwork (artSrc: the character portrait Jewel
// generated from the creator's style words at creation time, saved on
// the tool's config as artKey — lib/chance-art): on a six-sided die
// the character stands in for the dots, placed by this code in the
// pip positions, so a face always shows exactly as many characters as
// its value — the count is the game's, never painted. A die with
// another side count keeps its number face, and without artSrc the
// faces are the classic dots, unchanged.
export function DiceDisplay({result,sides=6,elapsed=0,preview=false,faceColor="#f5faff",pipColor="#102132",artSrc}:{result:number;sides?:number;elapsed?:number;preview?:boolean;faceColor?:string;pipColor?:string;artSrc?:string}){
 const rolling=!preview&&elapsed<1400;
 const face=rolling?1+Math.floor(elapsed/90)%sides:result;
 return <div className="chance-tool"><div className={'chance-die'+(rolling?' chance-die-rolling':'')} role="img" aria-label={rolling?'Dice rolling':`${sides}-sided die: ${face}`} style={{background:faceColor,color:pipColor,'--die-turn':`${Math.floor(elapsed/90)*40}deg`} as CSSProperties}>
 {sides===6?<div className="dice-pips">{Array.from({length:9},(_,i)=>pips[face]?.includes(i)?(artSrc?<img key={i} className="pip-face" src={artSrc} alt=""/>:<span key={i} className="pip"/>):<span key={i} className="pip-empty"/>)}</div>:<strong>{face}</strong>}</div><strong role="status">{preview?'Ready to roll':rolling?'Rolling…':`Result: ${result}`}</strong></div>;
}

export function CoinDisplay({result="Heads",elapsed=0,preview=false,ready=false,faceColor="#ffd166",textColor="#382608"}:{result?:string;elapsed?:number;preview?:boolean;ready?:boolean;faceColor?:string;textColor?:string}){
 const flipping=!preview&&!ready&&elapsed<1800;
 const face=result==="Tails"?"Tails":"Heads";
 return <div className="chance-tool"><div className="chance-coin-scene"><div className={'chance-coin'+(flipping?' chance-coin-flipping':'')} role="img" aria-label={ready?'Coin ready to flip':preview?'Coin design':flipping?'Coin flipping':`Coin landed on ${face}`} style={{background:faceColor,color:textColor} as CSSProperties}><span>{ready?'?':flipping?'?':face}</span></div></div><strong role="status">{ready||preview?'Ready to flip':flipping?'Flipping…':face}</strong></div>;
}

// ---------- Plinko ----------
// The animation presents an already-selected winner; it never draws another.
function mulberry32(seed:number){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
export function plinkoPath(winner:number,slots:number,rows:number){
  const rand=mulberry32(winner*7919+13);
  const raw:number[]=[0];for(let i=0;i<rows;i++)raw.push(raw[i]+(rand()<0.5?-1:1));
  const startX=200,targetX=(winner+0.5)*(400/Math.max(1,slots));
  const span=raw[rows]-raw[0]||1;
  return raw.map((v,i)=>({x:Math.min(390,Math.max(10,startX+(v-raw[0])*(targetX-startX)/span)),y:34+i*(336/Math.max(1,rows))}));
}
// The board artwork fills this 2080x1136 space; the live elements —
// the marquee title, the configured slot values, the puck and its
// light trail — are layered over it here. The artwork is the tool's
// OWN board when the caller resolves one (artSrc: the board artwork
// Jewel generated from the creator's style words at creation time,
// saved on the tool's config as boardArtKey — lib/plinko-art), and
// the neutral house board (public/game-art/plinko-board-default.webp)
// otherwise. The artwork never carries values or
// text; the layering below writes both. plinkoPath above still
// decides everything; the mapping below only re-plots the same points
// into the artwork's perspective (the cabinet narrows toward the
// top), and it is exact at the bottom: the last path point lands
// precisely on the winning slot's centre. The artwork carries the
// pegs now, so pegColor is kept only for prop compatibility.
const PLINKO_SLOT_X0=315,PLINKO_SLOT_X1=1775,PLINKO_SLOT_Y=1008;
function plinkoArtPoint(p:{x:number;y:number}){
  const t=(p.y-34)/336;
  const cx=1075-30*t,half=415+278.5*t;
  return {x:cx+((p.x-200)/190)*half,y:252+633*t};
}
export function PlinkoDisplay({slots,winner=0,rows=9,elapsed=0,duration=3000,preview=false,pegColor="#8b9bb4",ballColor="#ff5d5d",colors=["#154c69","#512b75"],textColor="#ffffff",title="Plinko",artSrc,fill=false}:{slots:string[];winner?:number;rows?:number;elapsed?:number;duration?:number;preview?:boolean;pegColor?:string;ballColor?:string;colors?:string[];textColor?:string;title?:string;artSrc?:string;fill?:boolean}){
  const S=Math.max(2,slots.length),R=Math.min(14,Math.max(4,rows||9));
  const win=Math.min(S-1,Math.max(0,winner));
  const progress=preview?0:Math.min(1,Math.max(0,elapsed/duration));
  const path=plinkoPath(win,S,R);
  const segs=path.length-1,ft=progress*segs,fi=Math.min(segs-1,Math.floor(ft)),fr=ft-fi;
  const ball={x:path[fi].x+(path[fi+1].x-path[fi].x)*fr,y:path[fi].y+(path[fi+1].y-path[fi].y)*fr};
  const landed=progress>=1;
  const slotW=(PLINKO_SLOT_X1-PLINKO_SLOT_X0)/S,slotCx=(i:number)=>PLINKO_SLOT_X0+(i+0.5)*slotW;
  const labelSize=Math.min(83,slotW/4);
  const titleSize=Math.min(84,Math.max(30,Math.round(675/Math.max(1,title.length))));
  const ballPos=preview?plinkoArtPoint(path[0]):landed?{x:slotCx(win),y:PLINKO_SLOT_Y}:plinkoArtPoint(ball);
  const trail=!preview&&progress>0&&!landed?[...path.slice(Math.max(0,fi-2),fi+1).map(plinkoArtPoint),ballPos]:[];
  // The artwork must never render blank. A resolved artSrc can still
  // be a dead URL — a published snapshot keeps pointing at the asset
  // record after the stored object behind it is gone (the live
  // overlay rendered a dark empty panel for exactly this on
  // 2026-11-15: the record resolved, the file 404'd). Probe the URL
  // and let the image itself report failure too; either way the
  // neutral house board takes the dead artwork's place.
  const [artBroken,setArtBroken]=useState(false);
  useEffect(()=>{setArtBroken(false);if(!artSrc)return;let live=true;const probe=new Image();probe.onerror=()=>{if(live)setArtBroken(true)};probe.src=artSrc;return ()=>{live=false};},[artSrc]);
  const ownArt=!!artSrc&&!artBroken;
  const boardSrc=ownArt?artSrc:PLINKO_HOUSE_BOARD;
  return <div className={fill?"chance-tool chance-tool-fill":"chance-tool"}><div className="chance-plinko"><svg viewBox="0 0 2080 1136" role="img" aria-label={preview?'Plinko board design':landed?`Plinko landed on ${slots[win]}`:'Plinko ball dropping'}>
    <image href={boardSrc} preserveAspectRatio={ownArt ? "none" : undefined} x={0} y={0} width={2080} height={1136} onError={()=>setArtBroken(true)}/>
    <text className="chance-plinko-title" x={1072} y={124} textAnchor="middle" fill={textColor} fontSize={titleSize} fontWeight={900} letterSpacing={Math.round(titleSize*0.1)} stroke="rgba(8,4,26,.9)" strokeWidth={3} paintOrder="stroke">{title}</text>
    {slots.map((s,i)=><g key={i} className={landed&&i===win?"chance-plinko-slot-win":undefined}>{landed&&i===win&&<rect x={PLINKO_SLOT_X0+i*slotW+5} y={948} width={slotW-10} height={118} rx={20} fill={colors[i%colors.length]} opacity={.45} stroke="#ffd166" strokeWidth={6}/>}<text x={slotCx(i)} y={PLINKO_SLOT_Y+labelSize*0.36} textAnchor="middle" fill={textColor} fontSize={labelSize} fontWeight={800} stroke="rgba(8,4,26,.92)" strokeWidth={Math.max(3,labelSize/10)} paintOrder="stroke">{s.length>8?s.slice(0,7)+'…':s}</text></g>)}
    {trail.length>1&&<polyline className="chance-plinko-trail" points={trail.map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke={ballColor} strokeWidth={24} strokeLinecap="round" strokeLinejoin="round"/>}
    <g><circle className="chance-plinko-halo" cx={ballPos.x} cy={ballPos.y} r={70} fill={ballColor}/><circle cx={ballPos.x} cy={ballPos.y} r={46} fill={ballColor} stroke="#fff" strokeWidth={5}/><circle cx={ballPos.x-14} cy={ballPos.y-14} r={13} fill="#ffffff" opacity=".85"/></g>
  </svg></div><strong role="status" className="chance-status">{preview?'Ready to drop':landed?`Landed on ${slots[win]}!`:'Dropping…'}</strong></div>;
}

// ---------- Higher or Lower ----------
// Cards carry a rank label and a value but no suit, so the suit is
// derived deterministically from the card itself — the same card
// always shows the same suit, on every surface.
const HL_SUITS=[{g:'♠',red:false},{g:'♥',red:true},{g:'♦',red:true},{g:'♣',red:false}];
export function cardSuit(label:string,value:number){const h=[...String(label)].reduce((a,c)=>a+c.charCodeAt(0),0);return HL_SUITS[(Math.abs(Math.round(Number(value)||0))*3+h)%4];}
function PlayingCard({label,value,small=false,flip=false,deal=false}:{label:string;value:number;small?:boolean;flip?:boolean;deal?:boolean}){
  const suit=cardSuit(label,value);
  return <div className={`chance-card${small?' small':''}${suit.red?' red':''}${flip?' chance-card-flip':''}${deal?' chance-card-deal':''}`}>
    <div className="chance-card-corner"><strong>{label}</strong><span>{suit.g}</span></div>
    <div className="chance-card-pip">{suit.g}</div>
    <div className="chance-card-corner flip"><strong>{label}</strong><span>{suit.g}</span></div>
  </div>;
}
export type HigherLowerOutcome={phase:'draw'|'reveal';card?:{label:string;value:number};prev?:{label:string;value:number};next?:{label:string;value:number};guess?:'higher'|'lower';correct?:boolean};
// The game's OWN artwork (artSrc: the card-table stage Jewel
// generated from the creator's style words at creation time, saved on
// the tool's config as artKey — lib/chance-art) fills the stage
// behind the cards; the cards themselves are drawn by the code over
// it, unchanged, because the artwork never carries labels. Without
// artSrc the stage is the standard design, unchanged.
export function HigherLowerDisplay({outcome,elapsed=0,preview=false,textColor="#ffffff",artSrc}:{outcome?:HigherLowerOutcome;elapsed?:number;preview?:boolean;textColor?:string;artSrc?:string}){
  const o=outcome||{phase:'draw',card:{label:'?',value:0}};
  const revealing=o.phase==='reveal';
  const done=!preview&&revealing;
  return <div className="chance-tool"><div className="chance-hl" role="img" style={artSrc?{backgroundImage:`url("${artSrc}")`,backgroundSize:"cover",backgroundPosition:"center"}:undefined} aria-label={preview?'Higher or Lower design':revealing?`Was ${o.next?.label} higher or lower than ${o.prev?.label}? ${o.correct?'Correct':'Wrong'}`:`Current card ${o.card?.label}`}>
    {!revealing&&<><small style={{color:textColor,opacity:.75}}>CURRENT CARD</small><div className="chance-hl-stage"><PlayingCard label={o.card?.label??'?'} value={o.card?.value??0} deal={!preview}/><div className="chance-card back" aria-hidden="true"><span>★</span></div></div><p style={{color:textColor}}>Higher or lower than the next card?</p></>}
    {revealing&&<><div className="chance-hl-row"><PlayingCard label={o.prev?.label??'?'} value={o.prev?.value??0} small/><span className="chance-hl-arrow">→</span><PlayingCard label={o.next?.label??'?'} value={o.next?.value??0} small flip/></div><p style={{color:textColor}}>You guessed <strong>{o.guess?.toUpperCase()}</strong></p><strong role="status" className={o.correct?'chance-hl-good':'chance-hl-bad'}>{done?(o.correct?'✓ CORRECT!':'✗ WRONG'):preview?'':'Revealing…'}</strong></>}
    {preview&&!revealing&&<p style={{color:textColor}}>Draw a card to begin</p>}
  </div></div>;
}

// ---------- Cliffhanger ----------
export type CliffhangerOutcome={phase:'item'|'guess'|'reset';item?:{label:string;price:number};itemIndex?:number;guess?:number;price?:number;diff?:number;steps?:number;position?:number;fell?:boolean;stepsToFall?:number;dollarsPerStep?:number};
// The game's OWN artwork (artSrc: the alpine stage backdrop Jewel
// generated from the creator's style words at creation time, saved on
// the tool's config as artKey — lib/chance-art) fills the scene's
// frame behind the mountain; the mountain, the steps, and the
// climber are drawn by the code over it, on the same climb path as
// always, because the artwork never carries the game. Without artSrc
// the scene is the standard design, unchanged.
export function CliffhangerDisplay({outcome,elapsed=0,preview=false,textColor="#ffffff",artSrc}:{outcome?:CliffhangerOutcome;elapsed?:number;preview?:boolean;textColor?:string;artSrc?:string}){
  const o=outcome||{phase:'reset' as const,position:0,stepsToFall:25};
  const total=Math.max(5,o.stepsToFall||25),pos=Math.min(total,Math.max(0,o.position||0));
  const fromPos=o.phase==='guess'?Math.max(0,pos-(o.steps||0)):0;
  const progress=preview?0:Math.min(1,Math.max(0,elapsed/1500));
  const shown=Math.round(fromPos+(pos-fromPos)*progress);
  // The climb: up the left slope to the summit (80% of the steps),
  // then a short ledge walk to the cliff edge. The last quarter of
  // the route is the danger zone.
  const climbPoint=(t:number)=>{if(t<=0.8){const u=t/0.8;return {x:64+(195-64)*u,y:398+(70-398)*u};}const u=(t-0.8)/0.2;return {x:195+(252-195)*u,y:70};};
  const cp=climbPoint(shown/total);
  const dangerStart=climbPoint(0.75),peak=climbPoint(0.8),edge=climbPoint(1);
  const steps=[];for(let i=0;i<=total;i++){const t=i/total,p=climbPoint(t);steps.push(<line key={i} x1={p.x-8} y1={p.y+4} x2={p.x+8} y2={p.y+4} stroke={t>=0.75?"#ff6b6b":"#ffe1a8"} strokeWidth={3} strokeLinecap="round"/>);}
  const burst=Array.from({length:16},(_,i)=>{const a=i*Math.PI/8,r=i%2?24:56;return `${(200+r*Math.cos(a)).toFixed(1)},${(36+r*Math.sin(a)*0.55).toFixed(1)}`;}).join(' ');
  return <div className="chance-tool"><div className="chance-cliff" role="img" aria-label={preview?'Cliffhanger design':o.fell?'The climber fell off the cliff':`Climber at step ${shown} of ${total}`}>
    <svg viewBox="0 0 400 440">
      <defs>
       <linearGradient id="cliff-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#274b73"/><stop offset="58%" stopColor="#7ba7cf"/><stop offset="100%" stopColor="#d9b98a"/></linearGradient>
       <linearGradient id="cliff-rock" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#77879c"/><stop offset="45%" stopColor="#54637a"/><stop offset="100%" stopColor="#333f52"/></linearGradient>
       {artSrc&&<clipPath id="cliff-art-clip"><rect x="3" y="3" width="394" height="434" rx="18"/></clipPath>}
      </defs>
      {artSrc?<><g clipPath="url(#cliff-art-clip)"><image href={artSrc} x={0} y={0} width={400} height={440} preserveAspectRatio="xMidYMid slice"/></g><rect x="3" y="3" width="394" height="434" rx="18" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="2"/></>:<rect x="3" y="3" width="394" height="434" rx="18" fill="url(#cliff-sky)" stroke="rgba(255,255,255,.35)" strokeWidth="2"/>}
      <circle cx="330" cy="66" r="30" fill="#ffd166" opacity=".22"/>
      <circle cx="330" cy="66" r="19" fill="#ffd166" opacity=".9"/>
      <polygon points="0,412 92,268 178,412" fill="#54687f" opacity=".45"/>
      <polygon points="212,412 316,238 400,412" fill="#54687f" opacity=".4"/>
      <polygon points="30,412 195,58 258,58 264,238 372,412" fill="url(#cliff-rock)" stroke="rgba(255,255,255,.3)" strokeWidth="1.5"/>
      <polygon points="170,100 195,58 220,100 207,88 195,100 183,88" fill="#f4f9ff" opacity=".95"/>
      <path d={`M${climbPoint(0).x} ${climbPoint(0).y} L${peak.x} ${peak.y} L${edge.x} ${edge.y}`} fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="2" strokeDasharray="5 6"/>
      <path d={`M${dangerStart.x} ${dangerStart.y} L${peak.x} ${peak.y} L${edge.x} ${edge.y}`} fill="none" stroke="rgba(255,59,59,.32)" strokeWidth="15" strokeLinejoin="round" strokeLinecap="round"/>
      {steps}
      <g transform={`translate(${dangerStart.x-13},${dangerStart.y-16})`}><polygon points="0,-9 8.5,6 -8.5,6" fill="#ffb020" stroke="#7a4d00" strokeWidth="1.2"/><text x="0" y="4.5" textAnchor="middle" fontSize="11" fontWeight="900" fill="#402e00">!</text></g>
      <line x1="195" y1="58" x2="195" y2="33" stroke="#402e1e" strokeWidth="3" strokeLinecap="round"/>
      <polygon points="195,33 220,39.5 195,46.5" fill="#e2452f"/>
      <g transform={`translate(${cp.x},${cp.y-5})`}><g className={o.fell?"chance-cliff-fall":"chance-cliff-bob"}>
        <rect x="-12.5" y="-17" width="8" height="13" rx="3" fill="#2e9e5b" stroke="rgba(0,0,0,.25)"/>
        <path d="M0 -3 L-5 6 M0 -3 L5 5" stroke="#26324a" strokeWidth="3.4" strokeLinecap="round" fill="none"/>
        <rect x="-3.4" y="-16" width="6.8" height="14" rx="3.2" fill="#ff7847" stroke="rgba(0,0,0,.2)" strokeWidth=".6"/>
        <path d="M1 -13 L8 -7" stroke="#ff7847" strokeWidth="3" strokeLinecap="round"/>
        <circle cy="-22" r="5.6" fill="#f2c094"/>
        <path d="M-5.8 -22.6 A5.8 5.8 0 0 1 5.8 -22.6 L8.6 -21 L-5.8 -21 Z" fill="#d92b2b"/>
      </g></g>
      {o.fell&&<g><polygon points={burst} fill="#d92b2b" stroke="#ffb3ab" strokeWidth="1.5"/><text x="200" y="43" textAnchor="middle" fill="#ffffff" fontSize="17" fontWeight="900">HE FALLS!</text></g>}
    </svg>
    {o.item&&o.phase!=='reset'&&<p style={{color:textColor}}><strong>{o.item.label}</strong></p>}
    {o.phase==='guess'&&<p style={{color:textColor}}>Guessed <strong>{o.guess}</strong> · actual <strong>{o.price}</strong> · off by {o.diff} → climbs {o.steps} {o.steps===1?'step':'steps'}</p>}
    {o.phase==='reset'&&!preview&&<p style={{color:textColor}}>Climber reset. New game!</p>}
    {preview&&<p style={{color:textColor}}>Guess prices — don't let him fall!</p>}
  </div></div>;
}

