const fs=require('fs'),vm=require('vm'),ts=require('typescript'),path=require('path');
const cache={};
module.exports=function load(file){
 if(cache[file])return cache[file];
 const exports={};cache[file]=exports;
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 vm.runInNewContext(code,{exports,require:id=>id.startsWith('.')?load(path.join(path.dirname(file),id+'.ts')):require(id),crypto:require('node:crypto').webcrypto,Uint32Array,Date,Math,Set,AbortController,setTimeout,clearTimeout});
 return exports;
};
