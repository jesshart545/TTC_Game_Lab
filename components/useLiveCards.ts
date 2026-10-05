"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import type {CardState,CardAction} from '../lib/question-cards';
export function useLiveCards(slug:string,hostKey?:string){
 const [states,setStates]=useState<Record<string,CardState>>({}),[error,setError]=useState('');const latest=useRef(states);latest.current=states;
 const endpoint='/api/live/'+encodeURIComponent(slug)+'/cards';
 useEffect(()=>{if(hostKey==='')return;let cancelled=false,timer:ReturnType<typeof setTimeout>;const refresh=async()=>{try{const response=await fetch(endpoint,{headers:hostKey?{'x-host-key':hostKey}:{},cache:'no-store'});const data=await response.json();if(!response.ok)throw new Error(data.error||'Unable to load card state.');if(!cancelled){setStates(previous=>{const next=data.states as Record<string,CardState>;return JSON.stringify(previous)===JSON.stringify(next)?previous:next;});setError('');}}catch(e){if(!cancelled)setError(e instanceof Error?e.message:'Unable to load cards.');}finally{if(!cancelled)timer=setTimeout(refresh,500);}};void refresh();return()=>{cancelled=true;clearTimeout(timer);};},[endpoint,hostKey]);
 const command=useCallback(async(toolId:string,action:CardAction,text='')=>{if(!hostKey)throw new Error('Open the private dashboard from the builder.');const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','x-host-key':hostKey},body:JSON.stringify({toolId,action,text,version:latest.current[toolId]?.version??0})});const data=await response.json();if(!response.ok)throw new Error(data.error||'Card action failed.');latest.current={...latest.current,[toolId]:data.state};setStates(latest.current);},[endpoint,hostKey]);
 return {states,command,error};
}
