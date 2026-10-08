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
