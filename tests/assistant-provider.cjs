const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
function config(env){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/assistant-provider.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,process:{env},URL,Set,Array});return exports.assistantProvider();}
const defaultProvider=config({AGNES_API_KEY:'mock-default',AGNES_MODEL:'custom-fallback'});
assert.equal(defaultProvider.url,'https://apihub.agnes-ai.com/v1/chat/completions');assert.equal(defaultProvider.key,'mock-default');assert.equal(defaultProvider.models[0],'agnes-2.5-flash');
const own=config({TTC_AI_BASE_URL:'https://inference.example/v1/',TTC_AI_MODEL:'my-model',TTC_AI_API_KEY:'mock-custom',AGNES_API_KEY:'mock-default'});
assert.equal(own.url,'https://inference.example/v1/chat/completions');assert.equal(own.key,'mock-custom');assert.equal(own.models.length,1);assert.equal(own.models[0],'my-model');
for(const url of ['http://inference.example/v1','https://name:password@inference.example/v1','https://inference.example/v1?token=bad','https://inference.example/v1#bad'])assert.throws(()=>config({TTC_AI_BASE_URL:url}));
console.log('PASS: existing provider default, explicit owner-controlled endpoint/model/key overrides and secure URL requirements.');
