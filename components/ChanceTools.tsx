"use client";
import type { CSSProperties } from 'react';
import './chance-tools.css';

// The animation presents an already-selected result; it never draws another winner.
export function wheelRotation(winner:number,count:number,progress:number){return (2160-(winner+.5)*360/Math.max(1,count))*(1-Math.pow(1-Math.min(1,Math.max(0,progress)),4));}
export function WheelDisplay({entries,result,elapsed=0,duration=4000,preview=false,colors=["#154c69","#512b75"],textColor="#ffffff"}:{entries:string[];result:string;elapsed?:number;duration?:number;preview?:boolean;colors?:string[];textColor?:string}) {
 const winner=Math.max(0,entries.indexOf(result));
 const slice=360/Math.max(1,entries.length);
 const progress=preview?0:Math.min(1,Math.max(0,elapsed/duration));
 const rotation=wheelRotation(winner,entries.length,progress);
 const point=(angle:number)=>[100+92*Math.cos((angle-90)*Math.PI/180),100+92*Math.sin((angle-90)*Math.PI/180)];
 return <div className="chance-tool"><div className="chance-wheel"><svg viewBox="0 0 200 200" role="img" aria-label={preview?'Wheel design':progress<1?'Wheel spinning':`Wheel landed on ${result}`}>
 <g transform={`rotate(${rotation} 100 100)`}>{entries.map((label,i)=>{const start=point(i*slice),end=point((i+1)*slice),center=(i+.5)*slice;return <g key={i}>{entries.length===1?<circle cx="100" cy="100" r="92" fill={colors[0]}/>:<path d={`M100 100 L${start.join(' ')} A92 92 0 ${slice>180?1:0} 1 ${end.join(' ')} Z`} fill={colors[i%colors.length]} stroke="white" strokeWidth=".7"/>}<text transform={`rotate(${center} 100 100)`} x="100" y="30" textAnchor="middle" fill={textColor} fontSize={entries.length>16?5:8}>{label.length>22?label.slice(0,21)+'…':label}</text></g>;})}</g><circle cx="100" cy="100" r="10" fill="#0b111e" stroke="white"/><path d="M91 1 L109 1 L100 18 Z" fill="#fff" stroke="#101827"/></svg></div>
 {!entries.length?<p role="alert">Add entries in Workshop.</p>:<strong role="status">{preview?'Ready to spin':progress<1?'Spinning…':result}</strong>}</div>;
}
const pips:Record<number,number[]>={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
export function DiceDisplay({result,sides=6,elapsed=0,preview=false,faceColor="#f5faff",pipColor="#102132"}:{result:number;sides?:number;elapsed?:number;preview?:boolean;faceColor?:string;pipColor?:string}){
 const rolling=!preview&&elapsed<1400;
 const face=rolling?1+Math.floor(elapsed/90)%sides:result;
 return <div className="chance-tool"><div className={'chance-die'+(rolling?' chance-die-rolling':'')} role="img" aria-label={rolling?'Dice rolling':`${sides}-sided die: ${face}`} style={{background:faceColor,color:pipColor,'--die-turn':`${Math.floor(elapsed/90)*40}deg`} as CSSProperties}>
 {sides===6?<div className="dice-pips">{Array.from({length:9},(_,i)=><span key={i} className={pips[face]?.includes(i)?'pip':'pip-empty'}/>)}</div>:<strong>{face}</strong>}</div><strong role="status">{preview?'Ready to roll':rolling?'Rolling…':`Result: ${result}`}</strong></div>;
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
export function PlinkoDisplay({slots,winner=0,rows=9,elapsed=0,duration=3000,preview=false,pegColor="#8b9bb4",ballColor="#ff5d5d",colors=["#154c69","#512b75"],textColor="#ffffff",title="Plinko"}:{slots:string[];winner?:number;rows?:number;elapsed?:number;duration?:number;preview?:boolean;pegColor?:string;ballColor?:string;colors?:string[];textColor?:string;title?:string}){
  const S=Math.max(2,slots.length),R=Math.min(14,Math.max(4,rows||9));
  const w=400/S,win=Math.min(S-1,Math.max(0,winner));
  const progress=preview?0:Math.min(1,Math.max(0,elapsed/duration));
  const path=plinkoPath(win,S,R);
  const segs=path.length-1,ft=progress*segs,fi=Math.min(segs-1,Math.floor(ft)),fr=ft-fi;
  const ball={x:path[fi].x+(path[fi+1].x-path[fi].x)*fr,y:path[fi].y+(path[fi+1].y-path[fi].y)*fr};
  const landed=progress>=1;
  const pegs:React.ReactNode[]=[];
  for(let r=0;r<R;r++){const y=34+r*(336/Math.max(1,R));const n=S-(r%2?1:0);for(let i=0;i<n;i++){const x=(i+(r%2?1:0.5))*(400/Math.max(1,S));if(x>6&&x<394)pegs.push(<circle key={`${r}-${i}`} cx={x} cy={y} r={4} fill={pegColor}/>);}}
  return <div className="chance-tool"><div className="chance-plinko"><svg viewBox="0 0 400 470" role="img" aria-label={preview?'Plinko board design':landed?`Plinko landed on ${slots[win]}`:'Plinko ball dropping'}>
    <text x="200" y="20" textAnchor="middle" fill={textColor} fontSize="16" fontWeight="800">{title}</text>
    {pegs}
    {slots.map((s,i)=><g key={i}><rect x={i*w+2} y={404} width={w-4} height={56} rx={6} fill={colors[i%colors.length]} stroke={landed&&i===win?"#ffd166":"rgba(255,255,255,.25)"} strokeWidth={landed&&i===win?3:1}/><text x={i*w+w/2} y={438} textAnchor="middle" fill={textColor} fontSize={Math.min(16,w/4)} fontWeight="700">{s.length>8?s.slice(0,7)+'…':s}</text></g>)}
    {!preview&&<circle cx={ball.x} cy={ball.y} r={9} fill={ballColor} stroke="#fff" strokeWidth={2}/>}
    {preview&&<circle cx={200} cy={34} r={9} fill={ballColor} stroke="#fff" strokeWidth={2}/>}
  </svg></div><strong role="status">{preview?'Ready to drop':landed?`Landed on ${slots[win]}!`:'Dropping…'}</strong></div>;
}

// ---------- Higher or Lower ----------
export type HigherLowerOutcome={phase:'draw'|'reveal';card?:{label:string;value:number};prev?:{label:string;value:number};next?:{label:string;value:number};guess?:'higher'|'lower';correct?:boolean};
export function HigherLowerDisplay({outcome,elapsed=0,preview=false,textColor="#ffffff"}:{outcome?:HigherLowerOutcome;elapsed?:number;preview?:boolean;textColor?:string}){
  const o=outcome||{phase:'draw',card:{label:'?',value:0}};
  const revealing=o.phase==='reveal';
  const done=!preview&&revealing;
  return <div className="chance-tool"><div className="chance-hl" role="img" aria-label={preview?'Higher or Lower design':revealing?`Was ${o.next?.label} higher or lower than ${o.prev?.label}? ${o.correct?'Correct':'Wrong'}`:`Current card ${o.card?.label}`}>
    {!revealing&&<><small style={{color:textColor,opacity:.75}}>CURRENT CARD</small><div className="chance-hl-card"><strong>{o.card?.label??'?'}</strong></div><p style={{color:textColor}}>Higher or lower than the next card?</p></>}
    {revealing&&<><div className="chance-hl-row"><div className="chance-hl-card small"><strong>{o.prev?.label}</strong></div><span className="chance-hl-arrow">→</span><div className="chance-hl-card small"><strong>{o.next?.label}</strong></div></div><p style={{color:textColor}}>You guessed <strong>{o.guess?.toUpperCase()}</strong></p><strong role="status" className={o.correct?'chance-hl-good':'chance-hl-bad'}>{done?(o.correct?'✓ CORRECT!':'✗ WRONG'):preview?'':'Revealing…'}</strong></>}
    {preview&&!revealing&&<p style={{color:textColor}}>Draw a card to begin</p>}
  </div></div>;
}

// ---------- Cliffhanger ----------
export type CliffhangerOutcome={phase:'item'|'guess'|'reset';item?:{label:string;price:number};itemIndex?:number;guess?:number;price?:number;diff?:number;steps?:number;position?:number;fell?:boolean;stepsToFall?:number;dollarsPerStep?:number};
export function CliffhangerDisplay({outcome,elapsed=0,preview=false,textColor="#ffffff"}:{outcome?:CliffhangerOutcome;elapsed?:number;preview?:boolean;textColor?:string}){
  const o=outcome||{phase:'reset' as const,position:0,stepsToFall:25};
  const total=Math.max(5,o.stepsToFall||25),pos=Math.min(total,Math.max(0,o.position||0));
  const fromPos=o.phase==='guess'?Math.max(0,pos-(o.steps||0)):0;
  const progress=preview?0:Math.min(1,Math.max(0,elapsed/1500));
  const shown=Math.round(fromPos+(pos-fromPos)*progress);
  const peakY=40,baseY=400;
  const cy=baseY-(shown/total)*(baseY-peakY);
  const steps=[];for(let i=0;i<=total;i++){const y=baseY-(i/total)*(baseY-peakY);steps.push(<g key={i}><line x1={200-70*(i/total)-14} y1={y} x2={200-70*(i/total)+14} y2={y} stroke="rgba(255,255,255,.35)" strokeWidth={3}/></g>);}
  return <div className="chance-tool"><div className="chance-cliff" role="img" aria-label={preview?'Cliffhanger design':o.fell?'The climber fell off the cliff':`Climber at step ${shown} of ${total}`}>
    <svg viewBox="0 0 400 440">
      <path d="M40 420 L200 40 L360 420 Z" fill="#1d2b45" stroke="rgba(255,255,255,.25)" strokeWidth={2}/>
      {steps}
      <g transform={`translate(200,${cy})`}><circle r={11} fill="#ffd166" stroke="#7a4d00" strokeWidth={2}/><circle cy={-16} r={6} fill="#ffd166" stroke="#7a4d00" strokeWidth={2}/></g>
      {o.fell&&<text x="200" y="22" textAnchor="middle" fill="#ff7070" fontSize="20" fontWeight="900">HE FALLS!</text>}
    </svg>
    {o.item&&o.phase!=='reset'&&<p style={{color:textColor}}><strong>{o.item.label}</strong></p>}
    {o.phase==='guess'&&<p style={{color:textColor}}>Guessed <strong>${o.guess}</strong> · actual <strong>${o.price}</strong> · off by ${o.diff} → climbs {o.steps} {o.steps===1?'step':'steps'}</p>}
    {o.phase==='reset'&&!preview&&<p style={{color:textColor}}>Climber reset. New game!</p>}
    {preview&&<p style={{color:textColor}}>Guess prices — don't let him fall!</p>}
  </div></div>;
}

// ---------- Big Wheel (Price-is-Right style) ----------
export type PrizeWheelOutcome={phase?:'spin'|'nextplayer';winner?:number;values?:string[];total?:number;busted?:boolean};
export function PrizeWheelDisplay({outcome,elapsed=0,duration=4000,preview=false,colors=["#b3123f","#0f6b4f"],textColor="#ffffff"}:{outcome?:PrizeWheelOutcome;elapsed?:number;duration?:number;preview?:boolean;colors?:string[];textColor?:string}){
  const values=outcome?.values||[];
  const fmt=(c:number)=>`$${(c/100).toFixed(2)}`;
  if(outcome?.phase==='nextplayer')return <div className="chance-tool"><strong role="status" style={{color:textColor}}>Next player — total reset to $0.00</strong></div>;
  const winner=Math.min(values.length-1,Math.max(0,outcome?.winner??0));
  const total=outcome?.total??0,busted=!!outcome?.busted;
  return <div className="chance-tool"><WheelDisplay entries={values} result={values[winner]||''} elapsed={elapsed} duration={duration} preview={preview} colors={colors} textColor={textColor}/>
  <p role="status" style={{color:busted?'#ff7070':textColor,fontWeight:800}}>Total: {fmt(total)}{busted?' — BUSTED! Over $1.00':total===100?' — $1.00! PERFECT!':''}</p></div>;
}
