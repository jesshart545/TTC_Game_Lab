"use client";
import {useState} from 'react';
import type {Project,ProjectEvent} from '../lib/project';
import {dashboardTargets,currentDashboardTarget} from '../lib/dashboard-actions';
export default function DashboardActionPicker({project,control,onApply}:{project:Project;control:ProjectEvent;onApply:(action:string,detail:string)=>void}){
 const targets=dashboardTargets(project,control.id);
 const [targetId,setTargetId]=useState(currentDashboardTarget(targets,control)),[action,setAction]=useState(control.action);
 const target=targets.find(t=>t.id===targetId),chosen=target?.actions.find(a=>a.value===action);
 return <section className="dashboard-action-picker" aria-label="Choose button behavior"><h4>Choose what this button does</h4><label>1. What should it control?<select value={targetId} onChange={e=>{setTargetId(e.target.value);setAction('');}}><option value="">Choose an item</option>{['Game tools','Media','Scenes'].map(group=><optgroup label={group} key={group}>{targets.filter(t=>t.group===group).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</optgroup>)}</select></label>{target&&<label>2. What happens when pressed?<select value={chosen?action:''} onChange={e=>setAction(e.target.value)}><option value="">Choose an action for {target.name}</option>{target.actions.map(a=><option value={a.value} key={a.value}>{a.label}</option>)}</select></label>}{chosen&&<p><strong>When the host presses this button:</strong> {chosen.help}</p>}<button type="button" disabled={!chosen} onClick={()=>chosen&&onApply(chosen.value,chosen.help)}>Save button action</button><p>Your current action stays in place until you save. You can test the button beside the overlay.</p>{!targets.length&&<p>Create an asset or game tool in Workshop first, then connect it here.</p>}{control.action==='sequence'&&!chosen&&<p>This button currently runs a saved sequence. Keep it as it is, or choose an item above to replace its sequence with one action.</p>}</section>;
}
