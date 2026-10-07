const normalize=(text:string)=>text.replace(/\s+/g,' ').trim();
export function groundedResearchCards(changes:Record<string,any>,evidence:unknown,existingTools:any[]=[]){
 const sources=Array.isArray(evidence)?evidence:[];
 const pools=[...(Array.isArray(changes.newTools)?changes.newTools:[]).filter(t=>t.type==='card-list'),...(Array.isArray(changes.gameTools)?changes.gameTools:[]).filter(t=>existingTools.some(e=>e.id===t.id&&e.type==='card-list'))];
 for(const pool of pools){
  if(!Array.isArray(pool.config?.cards))throw Error('Research cards need saved source excerpts.');
  pool.config.cards=pool.config.cards.map((card:any)=>{
   const source=sources.find(s=>s?.url===card.sourceUrl);
   const quote=typeof card.sourceQuote==='string'?normalize(card.sourceQuote):'';
   if(!source||!quote||quote.length>320||!normalize(String(source.summary||'')).toLowerCase().includes(quote.toLowerCase()))throw Error('Each researched card must include sourceQuote copied exactly from its cited searchEvidence summary, at most 320 characters. Do not add unsupported facts.');
   return {...card,text:quote,sourceQuote:quote,sourceTitle:String(source.title||'Source')};
  });
 }
 return changes;
}
