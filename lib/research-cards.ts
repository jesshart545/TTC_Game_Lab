const normalize=(text:string)=>text.replace(/\s+/g,' ').trim();
export function groundedResearchCards(changes:Record<string,any>,evidence:unknown,existingTools:any[]=[],request?:string){
 const sources=Array.isArray(evidence)?evidence:[];
 const pools=[...(Array.isArray(changes.newTools)?changes.newTools:[]).filter(t=>t.type==='card-list'),...(Array.isArray(changes.gameTools)?changes.gameTools:[]).filter(t=>existingTools.some(e=>e.id===t.id&&e.type==='card-list'))];
 if(pools.length&&typeof request==='string'&&!/\b(list|pool|cards?|questions?|trivia)\b/i.test(request))throw Error('The user asked for research in chat, not saved cards. Return the research answer without creating a list.');
 for(const pool of pools){
  const entries=pool.config?.entries||pool.config?.cards;
  if(!Array.isArray(entries))throw Error('Research pools need saved source excerpts.');
  pool.config.entries=entries.map((card:any)=>{
   const source=Number.isInteger(card.sourceId)&&card.sourceId>=0?sources[card.sourceId]:sources.find(s=>s?.url===card.sourceUrl);
   let quote=normalize(typeof card.sourceQuote==='string'?card.sourceQuote:typeof card.text==='string'?card.text:'');
   if(!source)throw Error('Choose a source URL from the search results. Invented source links cannot be saved.');
   const summary=normalize(String(source.summary||''));if(!summary)throw Error('That search result has no source excerpt to save.');
   // Pools store search excerpts, not model-written facts. Repair an unsupported
   // model quote directly from the actual result rather than inventing content.
   if(!quote||quote.length>320||!summary.toLowerCase().includes(quote.toLowerCase())){quote=summary.slice(0,320);if(summary.length>320&&quote.lastIndexOf(' ')>240)quote=quote.slice(0,quote.lastIndexOf(' '));}
   return {...card,text:quote,sourceQuote:quote,sourceUrl:String(source.url),sourceTitle:String(source.title||'Source')};
  });
  pool.config.cards=[];
 }
 // A requested replacement must update the saved pool, even if the model
 // describes its researched content as a new tool.
 if(typeof request==='string'&&/\b(replace|update|refresh)\b/i.test(request)&&Array.isArray(changes.newTools)){
  changes.newTools=changes.newTools.filter((tool:any)=>{
   const existing=existingTools.filter(e=>e.type==='card-list'&&typeof tool.name==='string'&&String(e.name).toLowerCase()===tool.name.toLowerCase()&&request.toLowerCase().includes(tool.name.toLowerCase()));
   if(tool.type!=='card-list'||!existing.length)return true;
   if(existing.length>1)throw Error('More than one saved pool has that name. Choose which pool to update.');
   changes.gameTools=[...(Array.isArray(changes.gameTools)?changes.gameTools:[]).filter((e:any)=>e.id!==existing[0].id),{id:existing[0].id,config:tool.config}];return false;
  });
 }
 return changes;
}
