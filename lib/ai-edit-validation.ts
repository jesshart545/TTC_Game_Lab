import {assignControlAction,controlConnectionError} from './control-connections';
import {requestedFont,resolveFont,isSupportedFont} from './fonts';
const record=(v:unknown):Record<string,any>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,any>:{};
// Catch omitted explicit settings before the application accepts a model edit.
export function validateExplicitSettings(request:string,response:unknown){
 const responseData=record(response),draftChanges=record(responseData.changes);
 if(/\btimer\b/i.test(request)&&/\b(?:cycle|cycles|cycling)\b/i.test(String(responseData.reply||''))&&!/\b(?:cycle|cycles|cycling)\b/i.test(request))throw new Error('The user did not request a timer press cycle. Timer show, start/pause, reset and hide are separate supported actions. Do not invent a duration editor on a button.');
 const perPress=/\b(?:each|every)\s+(?:press|click)\b|\b(?:first|second|third)\s+(?:press|click)\b/i.test(request);
 const wholeSequence=/\b(?:each|every)\s+(?:press|click)\b[^.\n]{0,45}\b(?:all|entire|whole)\b/i.test(request);
 if(perPress&&!wholeSequence&&Array.isArray(draftChanges.sequences)&&draftChanges.sequences.length)throw new Error('This request advances one step per separate press. Do not return an automatic sequence. Use coinCycles for Show / Flip / Remove on a coin, or explain a missing capability and ask for the necessary details.');
 const sequenceRequest=/\bsequence\b|\b(?:button|action|function)[ -](?:string|chain)\b|\b(?:string|chain|link|combine|connect)\b[^.\n]{0,70}\b(?:buttons?|actions?|functions?)\b/i.test(request);
 const promisedSequence=/\bI(?:'ll| will| have| am going to|’ll)\b[^.\n]{0,100}\b(?:set up|creat(?:e|ed)|add(?:ed)?|connect(?:ed)?|link(?:ed)?|build|built)\b/i.test(String(responseData.reply||''));
 if(sequenceRequest&&promisedSequence&&!responseData.action&&!Object.keys(draftChanges).length&&!String(responseData.reply||'').includes('?'))throw new Error('Return the actual requested changes.sequences with connected steps, or ask for missing information. Do not promise a button without saved changes.');
 const r=record(response),changes=record(r.changes),tools=[...(Array.isArray(changes.newTools)?changes.newTools:[]),...(Array.isArray(changes.gameTools)?changes.gameTools:[]),...(r.action?.type==='tool'?[{type:r.action.toolType,config:r.action.config}]:[])];
 if(/\bstrikes?\b/i.test(request)&&/\b(?:score\s*board|tally|counter|count|accumulat\w*)\b/i.test(request)&&tools.length&&!tools.some(t=>record(t.config).scoreMode==='strikes'))throw new Error('Use the supported scoreboard with config.scoreMode strikes for this team strike tally. Do not return a points scoreboard or an unsupported tool type.');
 if(/\bstrikes?\b/i.test(request)&&/\b(?:score\s*board|tally|counter)\b/i.test(request)&&/\b(?:add|create|make|want|need|set up)\b/i.test(request)&&!tools.length&&!Object.keys(changes).length&&!String(r.reply||'').includes('?'))throw new Error('Team strike tallies are supported. Return an actual scoreboard creation or edit with scoreMode strikes, or ask for missing team names. Do not refuse this supported task.');
 const controls=Array.isArray(changes.controls)?changes.controls:[],assets=Array.isArray(changes.assets)?changes.assets:[];
 if(!tools.length&&!controls.length&&!assets.length)return;
 const placements=[...tools.flatMap(t=>[record(t.config).placement,record(t.config).questionCard,record(t.config).answerCard]),...controls.map(c=>c.overlayResult),...assets.map(a=>record(a.edits).placement)].map(record);
 for(const field of ['x','y','width','height']){
  const match=request.match(new RegExp('\\b'+field+'\\s*(?:to|of|at|=|:)??\\s*(\\d+(?:\\.\\d+)?)\\s*(%|pixels?|px)?','i'));
  if(!match)continue;
  const expected=Number(match[1])*(match[2]&&match[2]!=='%'?100/(field==='x'||field==='width'?1920:1080):1);
  if(!placements.some(p=>Number.isFinite(p[field])&&Math.abs(p[field]-expected)<.1))throw new Error('Include the requested '+field+' '+match[1]+(match[2]||'%')+' in the saved placement.');
 }
 const appearances=[...tools.map(t=>record(t.config).appearance),...controls.map(c=>c.appearance),...tools.flatMap(t=>[record(t.config).questionCard,record(t.config).answerCard])].map(record);
 if(/\b(?:transparent|no background|remove (?:the |its |my )?background)\b/i.test(request)&&!appearances.some(a=>a.transparentBackground===true||a.backgroundColor==='transparent'))throw new Error('Save the requested transparent background with appearance.transparentBackground true, preserving the tool content.');
 if(/\b(?:no title|without (?:a |the )?title|hide (?:the |its |my )?title|remove (?:the |its |my )?title)\b/i.test(request)&&!appearances.some(a=>a.showTitle===false)&&!tools.some(t=>record(t.config).title===''||record(t.config).label===''))throw new Error('Save the requested hidden title with appearance.showTitle false; keep the tool name for organization.');
 const shape=/\brounded rectangle\b/i.test(request)?'rounded':/\b(?:circle|circular)\b/i.test(request)?'circle':/\boval\b/i.test(request)?'oval':/\brectangle\b/i.test(request)?'rectangle':null;
 if(shape&&!appearances.some(a=>a.shape===shape))throw new Error('Save the requested '+shape+' shape in appearance.shape.');
 const font=requestedFont(request)?.name;
 if(font&&!appearances.some(a=>a.fontFamily&&resolveFont(a.fontFamily)===resolveFont(font)))throw new Error('Include the requested '+font+' font in the saved appearance.');
 if(/\b(?:background|button)\b[^.\n]{0,50}\b(?:colou?r|purple|blue|red|green|black|white|pink)\b|\b(?:purple|blue|red|green|black|white|pink)\b[^.\n]{0,20}\bbackground\b/i.test(request)&&!appearances.some(a=>a.backgroundColor))throw new Error('Include the requested background color in the saved appearance.');
 const colors=request.match(/#[0-9a-f]{6}\b/gi)||[];
 for(const color of colors)if(!appearances.some(a=>[a.backgroundColor,a.textColor,a.color,a.accentColor].some(v=>String(v||'').toLowerCase()===color.toLowerCase())))throw new Error('Include the requested color '+color+' in the saved appearance.');
}

export function validateSavedReferences(project:any,input:unknown) {
 const changes=record(input);
 const fields=[['gameTools','gameTools','id'],['controls','controls','id'],['compositions','compositions','id'],['assets','assets','storageKey']] as const;
 for(const [field,collection,key] of fields) {
  if(changes[field]!==undefined&&!Array.isArray(changes[field]))throw new Error(`changes.${field} must be a list of edits.`);
  for(const raw of changes[field]||[]) {
   const item=record(raw);
   if(!project?.[collection]?.some((existing:any)=>(field==='assets'?(existing.storageKey||existing.name):existing.id)===item[key]))throw new Error(`changes.${field} references an unknown saved ${key}. Use the exact saved identity; do not invent or rename IDs.`);
  }
 }
 for(const raw of changes.controls||[]) {
  const item=record(raw),control=project.controls.find((c:any)=>c.id===item.id);
  if(typeof item.action==='string') {
   const action=item.action;
   const grammar=/^(?:timer\.(?:show|toggle|reset|hide)\..+|coin\.cycle\..+|asset\.show\..+|result\.hide\..+|cards\.(?:toggle|show|draw|reveal|clear|blank|score|award|new-game)\..+|tool\..+|background\.show\..+|composition\.play\..+|alert\.[a-z0-9._-]+|effect\.trigger|wheel\.spin|sequence)$/i;
   if(!grammar.test(action))throw new Error('The requested control action cannot execute. Use supported saved actions, not invented functions such as sequence.ID; new sequence controls are created by changes.sequences.');
   if(action.startsWith('background.show.')&&!project.assets?.some((a:any)=>(a.storageKey||a.name)===action.slice(16)))throw new Error('The background action references an unknown saved asset.');
   if(action.startsWith('composition.play.')&&!project.compositions?.some((c:any)=>c.id===action.slice(17)&&c.inProject))throw new Error('The composition action references an unavailable saved composition.');
   const error=controlConnectionError(project,assignControlAction(project,control,action));
   if(error)throw new Error(`The requested control action cannot execute: ${error}. New sequence buttons are created by changes.sequences; do not add or invent a control action sequence.ID.`);
  }
 }
 for(const field of ['controlOrder','removeControls']) {
  if(changes[field]!==undefined&&!Array.isArray(changes[field]))throw new Error(`changes.${field} must be a list of existing control IDs.`);
  if(changes[field]?.some((id:unknown)=>!project?.controls?.some((c:any)=>c.id===id)))throw new Error(`changes.${field} contains an unknown control ID. New IDs are created by the app; order/remove only existing controls.`);
 }
 for(const raw of changes.gameTools||[]) {
  const item=record(raw),tool=project.gameTools.find((t:any)=>t.id===item.id);
  if(tool?.type!=='countdown')continue;
  const config=record(item.config),old=record(tool.config),allowed=['seconds','display','placement','appearance','label','triggerOnly'];
  for(const key of Object.keys(config))if(!allowed.includes(key)&&JSON.stringify(config[key])!==JSON.stringify(old[key]))throw new Error(`Countdown config.${key} is not rendered or executed. Use documented countdown fields instead of ignored settings.`);
  const appearance=record(config.appearance),previous=record(old.appearance),fields=['backgroundColor','textColor','accentColor','fontFamily','fontSize','borderRadius','shape','showTitle','transparentBackground','showBorder'];
  for(const key of Object.keys(appearance))if(!fields.includes(key)&&JSON.stringify(appearance[key])!==JSON.stringify(previous[key]))throw new Error(`Countdown appearance.${key} is not supported by its renderer. Do not claim an artwork or animation edit from ignored fields.`);
  for(const key of ['backgroundColor','textColor','accentColor'])if(appearance[key]!==undefined&&!(typeof appearance[key]==='string'&&/^#[0-9a-f]{6}$/i.test(appearance[key])))throw new Error(`Use a valid six-digit hex color for countdown appearance.${key}.`);
  if(appearance.fontFamily!==undefined&&!isSupportedFont(appearance.fontFamily))throw new Error('Use one of the available fonts in countdown appearance.fontFamily.');
  if(config.display!==undefined&&!['numbers','bar','circle','numbers-bar','numbers-circle'].includes(config.display))throw new Error('Use an available countdown display mode.');
 }
 if(changes.sequences!==undefined&&!Array.isArray(changes.sequences))throw new Error('changes.sequences must be a list.');
 for(const raw of changes.sequences||[]) {
  const item=record(raw);
  if(item.id!==undefined&&!project?.controls?.some((c:any)=>c.id===item.id&&c.action==='sequence'))throw new Error('That id is not an existing sequence. For a NEW sequence omit id entirely; do not use the selected button or tool ID. For editing use executionGuide.sequenceContract.existingSequenceIds.');
 }
}
export function validateCompletionClaim(response:unknown) {
 const r=record(response),changes=record(r.changes);
 if(/\bI(?: have|'ve|’ve)?\s+(?:removed|deleted)\s+(?:(?:the|your|my|a|an|automatic|blank)\s+){0,4}(?:sequence|button|control|tool|board)\b/i.test(String(r.reply||'')))throw new Error('A draft proposal has not executed any removal. Describe what the prepared patch will remove only when removal is requested; never narrate rejected proposals as saved changes.');
 if(!r.action&&!Object.keys(changes).length&&(r.outcome==='edit'||/\b(?:I(?: have|'ve|’ve)?|I've|I’ve)\s+(?:successfully\s+)?(?:updated|changed|created|connected|configured|applied|added|removed|completed|made)\b|^\s*(?:done|completed|updated)[.!\s]/i.test(String(r.reply||''))))throw new Error('A completion claim has no executable action or saved changes. Return the actual supported edits, or a truthful clarification/limitation; do not report success from text alone.');
}

export function validateSequenceBehavior(before:any,after:any,input:unknown) {
 const changes=record(input);
 for(const raw of changes.sequences||[]) {
  const specification=record(raw);
  for(const step of specification.steps||[]) {
   const original=before.controls?.find((c:any)=>c.id===step.controlId);
   const current=after.controls?.find((c:any)=>c.id===step.controlId);
   if(original?.action?.startsWith('tool.')&&before.gameTools?.some((t:any)=>t.type==='countdown'&&original.action===`tool.${t.id}`)&&current?.action!==original.action)throw new Error('The sequence references a countdown Start control that this same response changed to show-only or another action. It would not begin the saved countdown. Preserve the Start action and use exact existing Start/Hide control IDs; do not add timerControls unless a separate show-only button is requested.');
  }
 }
}

export function validateRequestedAutomation(request:string,input:unknown) {
 const changes=record(input);
 const timed=(changes.sequences||[]).some((sequence:any)=>(sequence.steps||[]).some((step:any)=>Number(step.delaySeconds)>0));
 const requested=/\b(?:sequence|automatically|automatic|auto[- ]?(?:hide|remove)|wait|delay)\b|\bwhen\b[^.\n]{0,100}\b(?:ends?|finishes?|expires?|zero)\b|\bafter\b[^.\n]{0,50}\b(?:seconds?|countdown|timer|finishes?|ends?)\b/i.test(request);
 if(timed&&!requested)throw new Error('Timed automation was not explicitly requested. Preserve manual controls; apply unambiguous edits and ask whether removal should be automatic at countdown end or manual. Do not assume automatic behavior from a vague request to streamline.');
}

/** Sequences create their own button; additional tools need independent request grounding. */
export function validateSequenceAdditions(request:string,input:unknown,action?:unknown) {
 const changes=record(input);
 if(!Array.isArray(changes.sequences)||!changes.sequences.length)return;
 const toolAction=record(action);
 const additions=[...(Array.isArray(changes.newTools)?changes.newTools:[]),...(toolAction.type==='tool'?[{type:toolAction.toolType}]:[])];
 const mentions:Record<string,RegExp>={
  'blank-board':/\b(?:boards?|panels?)\b/i,
  scoreboard:/\b(?:score\s*boards?|leader\s*boards?|score\s+trackers?|team\s+scores?|strike\s+(?:tally|counter))\b/i,
  countdown:/\b(?:countdown|timer)\b/i,
  wheel:/\bwheel\b/i,'random-picker':/\b(?:picker|random\s+(?:image|card|item|choice))\b/i,
  poll:/\b(?:poll|vote|voting)\b/i,dice:/\b(?:dice|die)\b/i,'coin-toss':/\bcoin\b/i,
  youtube:/\byoutube\b/i,'prize-list':/\bprize\b/i,'game-tool-list':/\b(?:gift|tool\s+list)\b/i,
  'card-list':/\b(?:cards?|list|pool|trivia)\b/i,
 };
 for(const raw of additions){
  const tool=record(raw),pattern=mentions[String(tool.type)];
  if(pattern&&!pattern.test(request))throw new Error(`A new ${String(tool.type)} is unrelated to this sequence request. changes.sequences creates its own dashboard button; omit placeholder or unrelated newTools. Add a separate tool only when that tool is part of the user's request.`);
 }
}
