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
 const status=preview?'Ready to spin':progress<1?'Spinning…':(result||'Spin again');
 return <div className="chance-tool"><div className="chance-wheel"><svg viewBox="0 0 200 200" role="img" aria-label={preview?'Wheel design':progress<1?'Wheel spinning':`Wheel landed on ${result}`}>
 <defs><filter id="chance-wheel-shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity=".35"/></filter></defs>
 <g filter="url(#chance-wheel-shadow)" transform={`rotate(${rotation} 100 100)`}>{entries.map((label,i)=>{const start=point(i*slice),end=point((i+1)*slice),center=(i+.5)*slice;return <g key={i}>{entries.length===1?<circle cx="100" cy="100" r="92" fill={colors[0]}/>:<path d={`M100 100 L${start.join(' ')} A92 92 0 ${slice>180?1:0} 1 ${end.join(' ')} Z`} fill={colors[i%colors.length]} stroke="rgba(255,255,255,.85)" strokeWidth="1"/>}<text transform={`rotate(${center} 100 100)`} x="100" y="28" textAnchor="middle" fill={textColor} fontSize={entries.length>12?6:entries.length>8?7:9} fontWeight="600">{label.length>20?label.slice(0,19)+'…':label}</text></g>;})}</g><circle cx="100" cy="100" r="12" fill="#0b111e" stroke="#20e8ff" strokeWidth="2"/><path d="M90 2 L110 2 L100 18 Z" fill="#fff" stroke="#101827" strokeWidth="1.2"/></svg></div>
 {!entries.length?<p role="alert">Add wheel choices in Customize, then spin from the host dashboard.</p>:<strong className="chance-status" role="status">{status}</strong>}</div>;
}
const pips:Record<number,number[]>={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
export function DiceDisplay({result,sides=6,elapsed=0,preview=false,faceColor="#f5faff",pipColor="#102132"}:{result:number;sides?:number;elapsed?:number;preview?:boolean;faceColor?:string;pipColor?:string}){
 const rolling=!preview&&elapsed<1400;
 const face=rolling?1+Math.floor(elapsed/90)%sides:result;
 const status=preview?'Ready to roll':rolling?'Rolling…':`Result: ${result}`;
 return <div className="chance-tool"><div className={'chance-die'+(rolling?' chance-die-rolling':'')} role="img" aria-label={rolling?'Dice rolling':`${sides}-sided die: ${face}`} style={{background:faceColor,color:pipColor,'--die-turn':`${Math.floor(elapsed/90)*40}deg`} as CSSProperties}>
 {sides===6?<div className="dice-pips">{Array.from({length:9},(_,i)=><span key={i} className={pips[face]?.includes(i)?'pip':'pip-empty'}/>)}</div>:<strong className="chance-die-number">{face}</strong>}</div><strong className="chance-status" role="status">{status}</strong></div>;
}

export function CoinDisplay({result="Heads",elapsed=0,preview=false,ready=false,faceColor="#ffd166",textColor="#382608"}:{result?:string;elapsed?:number;preview?:boolean;ready?:boolean;faceColor?:string;textColor?:string}){
 const flipping=!preview&&!ready&&elapsed<1800;
 const face=result==="Tails"?"Tails":"Heads";
 const status=ready||preview?'Ready to flip':flipping?'Flipping…':face;
 return <div className="chance-tool"><div className="chance-coin-scene"><div className={'chance-coin'+(flipping?' chance-coin-flipping':'')} role="img" aria-label={ready?'Coin ready to flip':preview?'Coin design':flipping?'Coin flipping':`Coin landed on ${face}`} style={{background:faceColor,color:textColor} as CSSProperties}><span>{ready||flipping?'?':face}</span></div></div><strong className="chance-status" role="status">{status}</strong></div>;
}
