export type WebResult={title:string;url:string;summary:string;evidenceToken?:string};
function plain(value:unknown,max:number){return typeof value==="string"?value.replace(/<[^>]*>/g,"").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">").trim().slice(0,max):"";}
export function webResults(value:unknown):WebResult[] {
  if(!Array.isArray(value))return [];
  const found=new Set<string>();const results:WebResult[]=[];
  for(const item of value){
    if(!item||typeof item!=="object")continue;const row=item as Record<string,unknown>;
    try{const url=new URL(String(row.url));if(!["https:","http:"].includes(url.protocol)||url.username||url.password)continue;
      url.hash="";if(found.has(url.href))continue;const title=plain(row.title,300);if(!title)continue;
      found.add(url.href);results.push({title,url:url.href,summary:plain(row.content,1800)});if(results.length===10)break;
    }catch{/* Ignore invalid provider links. */}
  }return results;
}
