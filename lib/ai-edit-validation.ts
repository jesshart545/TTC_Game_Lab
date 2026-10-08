import {requestedFont,resolveFont} from './fonts';
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
