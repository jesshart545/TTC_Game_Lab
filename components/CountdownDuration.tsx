"use client";
import { useEffect, useState } from "react";

export default function CountdownDuration({seconds,onSave}:{seconds:number;onSave:(seconds:number)=>void}) {
 const duration=Number.isFinite(seconds)&&seconds>0?Math.floor(seconds):10;
 const [minutes,setMinutes]=useState(String(Math.floor(duration/60)));
 const [remaining,setRemaining]=useState(String(duration%60));
 const [message,setMessage]=useState('');
 useEffect(()=>{setMinutes(String(Math.floor(duration/60)));setRemaining(String(duration%60));},[duration]);
 const total=Number(minutes)*60+Number(remaining);
 const valid=minutes.trim()!==''&&remaining.trim()!==''&&Number.isInteger(Number(minutes))&&Number.isInteger(Number(remaining))&&Number(minutes)>=0&&Number(remaining)>=0&&Number(remaining)<60&&total>=1&&total<=86400;
 function setLength(value:number){onSave(value);setMinutes(String(Math.floor(value/60)));setRemaining(String(value%60));setMessage(`Timer set to ${Math.floor(value/60)} minutes, ${value%60} seconds.`);}
 return <section className="countdown-duration" aria-label="Countdown timer length"><h4>How long should this timer run?</h4><div className="timer-duration-fields"><label>Minutes<input type="number" min="0" max="1440" step="1" value={minutes} onChange={event=>{setMinutes(event.target.value);setMessage('');}}/></label><label>Seconds<input type="number" min="0" max="59" step="1" value={remaining} onChange={event=>{setRemaining(event.target.value);setMessage('');}}/></label><button type="button" disabled={!valid} onClick={()=>setLength(total)}>Set timer length</button></div><div className="timer-duration-presets" aria-label="Common timer lengths">{[[15,'15 seconds'],[30,'30 seconds'],[60,'1 minute'],[300,'5 minutes']].map(([value,label])=><button type="button" key={value} onClick={()=>setLength(Number(value))}>{label}</button>)}</div><p>The host controls when this timer starts and pauses.</p>{!valid&&<p role="status">Enter a duration from 1 second to 24 hours, with seconds between 0 and 59.</p>}{message&&<p role="status">{message}</p>}</section>;
}
