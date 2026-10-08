"use client";
import {useId} from 'react';
import {fontCatalog,fontGroups,resolveFont} from '../lib/fonts';
export default function FontPicker({value,onChange,label='Font'}:{value:string;onChange:(font:string)=>void;label?:string}){
 const id=useId(),font=resolveFont(value);
 return <div className="font-picker"><label htmlFor={id}>{label}</label><select id={id} value={font} onChange={event=>onChange(event.target.value)}>{fontGroups.map(group=><optgroup key={group} label={group}>{fontCatalog.filter(font=>font.group===group).map(font=><option key={font.family} value={font.family}>{font.name}</option>)}</optgroup>)}</select><span className="font-picker-preview" aria-label="Selected font preview" style={{fontFamily:font}}>Aa · Game Show 123</span></div>;
}
