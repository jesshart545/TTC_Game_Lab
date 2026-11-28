const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),path=require('path'),ts=require('typescript');

// Minimal TS/TSX module loader (tests/load.cjs pattern, plus JSX + CSS stubs).
const cache={};
function loadModule(file){
  const abs=path.resolve(__dirname,'..',file);
  if(cache[abs])return cache[abs];
  const exports={};cache[abs]=exports;
  const code=ts.transpileModule(fs.readFileSync(abs,'utf8'),{compilerOptions:{jsx:abs.endsWith('.tsx')?ts.JsxEmit.ReactJSX:undefined,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020},fileName:abs}).outputText;
  const localRequire=(id)=>{
    if(id.endsWith('.css'))return {};
    if(id.startsWith('.')){
      const base=path.join(path.dirname(abs),id);
      for(const cand of [base+'.tsx',base+'.ts',base]){if(fs.existsSync(cand)&&fs.statSync(cand).isFile())return loadModule(path.relative(path.resolve(__dirname,'..'),cand));}
      throw new Error('cannot resolve '+id+' from '+file);
    }
    return require(id);
  };
  vm.runInNewContext(code,{exports,require:localRequire,crypto:require('node:crypto').webcrypto,Uint32Array,Date,Math,Set,Map,AbortController,AbortSignal,setTimeout,clearTimeout,console});
  return exports;
}
const read=(f)=>fs.readFileSync(path.resolve(__dirname,'..',f),'utf8');
const {applyBuildChanges}=loadModule('lib/build-edits.ts');
const {cleanCharacterProfile,applyCharacterEdits,removeCharacter,characterRoster,checkedCharacterAttach,characterAttachPatch}=loadModule('lib/characters.ts');
const {validateSavedReferences}=loadModule('lib/ai-edit-validation.ts');

const img=(key,name)=>({name,type:'image/png',storageKey:key,inProject:true,inOverlayBuild:false});
const audio=(key,name)=>({name,type:'audio/mpeg',storageKey:key,inProject:true,inOverlayBuild:false});
const video=(key,name)=>({name,type:'video/mp4',storageKey:key,inProject:true,inOverlayBuild:false});
const project=(assets=[])=>({id:'proj',name:'Show',assets,controls:[],compositions:[],gameTools:[],assetPools:[],overlay:{},characters:[]});

/* ---------- No pre-fill (Jessica, 2026-11-28) ----------
 * The Flow package shipped a pre-typed narrative, a default style, a
 * default phase and a default outcome. None of that carries over: a
 * cleaned profile holds ONLY what was actually stated, and no preset
 * label from the package exists anywhere in the character code. */
{
  const cleaned=cleanCharacterProfile({name:'Nova'});
  assert.equal(cleaned.name,'Nova');
  for(const field of ['archetype','details','bodyType','mobilityAid','artStyle','voicePersona','voiceDescription','portraitKey','voiceKey']) assert.equal(cleaned[field],undefined,`cleanCharacterProfile must not inject a default for ${field}`);
  assert.deepEqual(Object.keys(cleaned),['name'],'a cleaned profile holds only what was stated — id and timestamps are stamped at creation, not by the cleaner');
  const source=read('lib/characters.ts');
  for(const preset of ['Cyberpunk Noir','High Fantasy','Sci-Fi Odyssey','Post-Apocalyptic','Thriller Mystery','Epic Victory','Tragic Defeat','Cliffhanger','Neon Sword Draw','Rooftop Leap','Arcane Surge','Cosmic Cockpit','plasma katanas','Photorealistic 8K','Anime Cinematic']) assert.ok(!source.includes(preset),`lib/characters.ts must not carry the package preset "${preset}"`);
}

/* ---------- Create files a character — unplaced, unwired ----------
 * Filing through changes.characters is the post-confirmation step of
 * the PR #229 creation flow: the character joins the project's
 * Characters collection and NOTHING is placed, connected, or added to
 * the dashboard. */
{
  const base=project([img('portrait-1','Nova portrait')]);
  const result=applyBuildChanges(base,{characters:[{name:'Nova',archetype:'Star pilot',details:'Silver-streaked hair, flight jacket',portraitKey:'portrait-1'}]});
  assert.equal(result.applied>0,true);
  assert.equal(result.project.characters.length,1);
  const nova=result.project.characters[0];
  assert.equal(nova.name,'Nova');
  assert.equal(nova.portraitKey,'portrait-1');
  assert.equal(nova.artStyle,undefined,'no style was stated, so none is stored');
  assert.equal(result.project.controls.length,0,'creating a character mints no dashboard control');
  assert.equal(result.project.gameTools.length,0,'creating a character creates no tool');
  const portrait=result.project.assets.find(a=>a.storageKey==='portrait-1');
  assert.equal(portrait.inOverlayBuild,false,'the portrait asset is filed, never placed');
}

/* ---------- A character is born only with a name ---------- */
{
  const result=applyCharacterEdits(project(),[{archetype:'Nameless ghost'}]);
  assert.equal(result.applied,0);
  assert.equal(result.characters.length,0);
}

/* ---------- Edit by id patches only the stated fields ---------- */
{
  const created=applyCharacterEdits(project(),[{name:'Nova',archetype:'Star pilot',details:'First draft'}]);
  const id=created.characters[0].id;
  const edited=applyCharacterEdits({...project(),characters:created.characters},[{id,details:'Second draft'}]);
  assert.equal(edited.characters[0].details,'Second draft');
  assert.equal(edited.characters[0].name,'Nova');
  assert.equal(edited.characters[0].archetype,'Star pilot');
  // An unknown id is skipped whole — never treated as a create.
  const skipped=applyCharacterEdits({...project(),characters:created.characters},[{id:'character-missing',name:'Impostor'}]);
  assert.equal(skipped.applied,0);
  assert.equal(skipped.characters.length,1);
}

/* ---------- Media keys are validated against the project's assets ----------
 * Keys Jewel cannot prove exist are dropped, never invented; reference
 * images (the optional upload channel) are recorded on the profile. */
{
  const base=project([img('ref-1','Reference'),img('portrait-1','Portrait')]);
  const result=applyCharacterEdits(base,[{name:'Nova',portraitKey:'not-a-real-key',referenceKeys:['ref-1','also-fake']}]);
  assert.equal(result.characters[0].portraitKey,undefined,'an unproven portrait key is dropped');
  assert.equal(JSON.stringify(result.characters[0].referenceKeys),JSON.stringify(['ref-1']),'only the real reference image is recorded');
  // A voice key pointing at an image is not a voice.
  const wrong=applyCharacterEdits(base,[{name:'Nova',voiceKey:'portrait-1'}]);
  assert.equal(wrong.characters[0].voiceKey,undefined);
}

/* ---------- Generation attachment: a character is born with its portrait ---------- */
{
  const base=project([img('gen-portrait','Nova generated portrait')]);
  const patch=characterAttachPatch({field:'portrait',profile:{name:'Nova',archetype:'Star pilot'}},'gen-portrait');
  const result=applyBuildChanges(base,patch);
  assert.equal(result.project.characters.length,1);
  assert.equal(result.project.characters[0].portraitKey,'gen-portrait');
  assert.equal(result.project.assets.find(a=>a.storageKey==='gen-portrait').inOverlayBuild,false);
  assert.equal(result.project.controls.length,0);
}

/* ---------- Attachment: voice and clips land on the saved character ---------- */
{
  const created=applyCharacterEdits(project(),[{name:'Nova'}]);
  const id=created.characters[0].id;
  const withMedia={...project([audio('voice-1','Nova voice'),video('clip-1','Nova clip one'),video('clip-2','Nova clip two')]),characters:created.characters};
  const voiced=applyBuildChanges(withMedia,characterAttachPatch({characterId:id,field:'voice'},'voice-1'));
  assert.equal(voiced.project.characters[0].voiceKey,'voice-1');
  const clipped=applyBuildChanges(voiced.project,characterAttachPatch({characterId:id,field:'clip'},'clip-1'));
  const clipped2=applyBuildChanges(clipped.project,characterAttachPatch({characterId:id,field:'clip'},'clip-2'));
  assert.equal(JSON.stringify(clipped2.project.characters[0].clipKeys),JSON.stringify(['clip-1','clip-2']),'clips accumulate on the character');
  assert.equal(clipped2.project.assets.find(a=>a.storageKey==='clip-2').inOverlayBuild,false,'an animated clip is filed, never placed');
}

/* ---------- Attach validation: bad targets fail correctably ---------- */
{
  const base=project();
  assert.throws(()=>checkedCharacterAttach({characterId:'character-nope',field:'portrait'},base),/not saved in this project/);
  assert.throws(()=>checkedCharacterAttach({field:'portrait',profile:{archetype:'No name'}},base),/at least the character's name/);
  assert.throws(()=>checkedCharacterAttach({field:'clip',profile:{name:'Nova'}},base),/already saved/,'a clip cannot birth a character');
  assert.throws(()=>checkedCharacterAttach({field:'voice',profile:{name:'Nova'}},base),/already saved/,'a voice cannot birth a character');
  assert.throws(()=>checkedCharacterAttach({field:'hat'},base),/needs field "portrait"/);
  assert.equal(checkedCharacterAttach({field:'portrait',profile:{name:'Nova'}},base).actionType,'image');
  const created=applyCharacterEdits(base,[{name:'Nova'}]);
  const withChar={...base,characters:created.characters};
  assert.equal(checkedCharacterAttach({characterId:created.characters[0].id,field:'voice'},withChar).actionType,'voice');
  assert.equal(checkedCharacterAttach({characterId:created.characters[0].id,field:'clip'},withChar).actionType,'video');
}

/* ---------- Roster resolves the character's media; removal keeps the media ---------- */
{
  const base=project([img('portrait-1','P'),img('ref-1','R'),audio('voice-1','V'),video('clip-1','C')]);
  const created=applyCharacterEdits(base,[{name:'Nova',portraitKey:'portrait-1',referenceKeys:['ref-1'],voiceKey:'voice-1'}]);
  const id=created.characters[0].id;
  const withClip=applyCharacterEdits({...base,characters:created.characters},[{id,clipKey:'clip-1'}]);
  const roster=characterRoster({...base,characters:withClip.characters});
  assert.equal(roster.length,1);
  assert.equal(roster[0].portrait.storageKey,'portrait-1');
  assert.equal(roster[0].references[0].storageKey,'ref-1');
  assert.equal(roster[0].voice.storageKey,'voice-1');
  assert.equal(roster[0].clips[0].storageKey,'clip-1');
  const removed=removeCharacter({...base,characters:withClip.characters},id);
  assert.equal(removed.length,0,'the creator can delete the character');
  assert.equal(base.assets.length,4,'deleting a character never deletes its media assets');
}

/* ---------- Saved-reference validation knows characters ---------- */
{
  const base=project();
  validateSavedReferences(base,{characters:[{name:'Nova'}]}); // a create needs no existing character — must not throw
  assert.throws(()=>validateSavedReferences(base,{characters:[{id:'character-nope',details:'x'}]}),/unknown saved id/,'an edit must name a saved character');
}

/* ---------- Jewel prompt pins, identical in both routes ----------
 * The character flow is taught once, the same words in both jewel
 * routes: two input channels with the typed description primary, no
 * pre-fill, examples offered never applied, confirm-before-filing,
 * prompt composition for animation, and the stack's honest limits. */
{
  const systemOf=(file)=>{
    const src=read(file);
    const start=src.indexOf('const DRAFT_SYSTEM = `');
    const end=src.indexOf('`;',start);
    return src.slice(start,end);
  };
  const jewel=systemOf('app/api/jewel/route.ts');
  const ai=systemOf('app/api/ai/route.ts');
  assert.equal(jewel,ai,'DRAFT_SYSTEM must stay byte-identical between the jewel and ai routes');
  const start=jewel.indexOf('CHARACTERS — THE CHARACTER STUDIO');
  assert.ok(start>=0,'the character studio teaching is present');
  const para=jewel.slice(start,jewel.indexOf('BUILDING A CONCEPT',start));
  for(const pin of [
    'changes.characters',
    'characterAttach',
    'NOTHING ABOUT A CHARACTER IS PRE-FILLED',
    'the PRIMARY input',
    'typed description alone',
    'never a required step',
    'get their confirmation like every other piece; if they do not approve it, the character is not filed with it',
    'use that file exactly as it is',
    'referenceKeys',
    'Compose the prompt from',
    'ONLY when the creator gave them — in their words or in words they picked from examples you offered',
    'clips are generated WIDESCREEN (16:9) only',
    'can NOT be woven into a generated video',
    'You cannot delete a character',
  ]) assert.ok(para.includes(pin),`character teaching must pin: ${pin}`);
  for(const preset of ['Cyberpunk Noir','Epic Victory','Tragic Defeat','Neon Sword Draw','plasma katanas']) assert.ok(!para.includes(preset),`the package preset "${preset}" must not appear as a wired value in the character teaching`);
  // The library shelf carries the Characters collection.
  const panel=read('components/WorkshopAssetsPanel.tsx');
  assert.ok(panel.includes('title="Characters"'),'the library shows a Characters collection');
  assert.ok(panel.includes('characterRoster'),'the shelf renders the roster');
  assert.ok(panel.includes('removeCharacter'),'the creator can delete a character from the shelf');
}

console.log('character-studio: all assertions passed');
