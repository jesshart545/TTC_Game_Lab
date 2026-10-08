"use client";
import {useEffect,useRef,useState} from 'react';
import type {GameTool} from '../lib/project';
export function useEditableTool(tool:GameTool,onSave:(tool:GameTool)=>void){
 const [draft,setDraft]=useState(tool),current=useRef(tool);
 useEffect(()=>{current.current=tool;setDraft(tool);},[tool]);
 const commit=(value:GameTool|((current:GameTool)=>GameTool))=>{const next=typeof value==='function'?value(current.current):value;current.current=next;setDraft(next);onSave(next);};
 const patchConfig=(patch:Record<string,unknown>)=>commit({...current.current,config:{...current.current.config,...patch}});
 const patchAppearance=(patch:Record<string,unknown>)=>patchConfig({appearance:{...(current.current.config.appearance as Record<string,unknown>||{}),...patch}});
 const patchTool=(patch:Partial<GameTool>)=>commit({...current.current,...patch});
 const patchDesign=(key:string,patch:Record<string,unknown>)=>patchConfig({[key]:{...(current.current.config[key] as Record<string,unknown>||{}),...patch}});
 return {draft,commit,patchConfig,patchAppearance,patchTool,patchDesign};
}
