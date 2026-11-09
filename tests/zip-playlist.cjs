const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),ts=require('typescript');
const output=ts.transpileModule(fs.readFileSync('lib/zip-playlist.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const exported={};vm.runInNewContext(output,{exports:exported,require:()=>({})});
const {planZipPlaylist,audioMimeTypeForName,playlistPoolName,isZipFileName,zipEntryBaseName}=exported;
const poolsOutput=ts.transpileModule(fs.readFileSync('lib/asset-pools.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const poolsExported={};vm.runInNewContext(poolsOutput,{exports:poolsExported,require:()=>({})});
const {poolAudioTracks}=poolsExported;

// Audio filtering: every accepted extension is a track; other real files are skipped.
{
  const plan=planZipPlaylist(['song.mp3','song.wav','song.m4a','song.aac','song.ogg','song.oga','song.opus','song.flac','song.webm','cover.jpg','notes.txt','movie.mp4','noextension']);
  assert.equal(plan.tracks.length,9,'all nine audio extensions become tracks');
  assert.equal(plan.skipped,4,'the image, text file, video and extensionless file count as skipped');
  console.log('PASS: zip playlist planning keeps every accepted audio extension and counts real non-audio files as skipped.');
}

// Junk skipping: folders, __MACOSX and dotfiles are ignored entirely — never tracks, never "skipped".
{
  const plan=planZipPlaylist(['Album/','Album/01 Intro.mp3','__MACOSX/._01 Intro.mp3','__MACOSX/Album/._cover.jpg','.DS_Store','Album/.hidden.mp3','Album/.DS_Store']);
  assert.deepEqual(Array.from(plan.tracks),['Album/01 Intro.mp3']);
  assert.equal(plan.skipped,0,'junk is not user content, so it is not reported as skipped');
  console.log('PASS: directory entries, __MACOSX AppleDouble files and dotfiles are ignored without counting as skipped.');
}

// Natural ordering: numeric collation on the file name, so track 2 precedes track 10.
{
  const plan=planZipPlaylist(['Album/track10.mp3','Album/track2.mp3','Album/track1.mp3','Other/track1.mp3','Album/03 Deep Cut.opus','Album/2 Song Two.wav']);
  assert.deepEqual(Array.from(plan.tracks),['Album/2 Song Two.wav','Album/03 Deep Cut.opus','Album/track1.mp3','Other/track1.mp3','Album/track2.mp3','Album/track10.mp3']);
  console.log('PASS: tracks are ordered by file name with numeric collation (2 before 10), full path breaking same-name ties.');
}

// MIME types come from the extension, case-insensitively; non-audio names have none.
{
  assert.equal(audioMimeTypeForName('TRACK.MP3'),'audio/mpeg');
  assert.equal(audioMimeTypeForName('song.FlAc'),'audio/flac');
  assert.equal(audioMimeTypeForName('song.webm'),'audio/webm');
  assert.equal(audioMimeTypeForName('cover.jpg'),'');
  assert.equal(audioMimeTypeForName('noextension'),'');
  console.log('PASS: audio MIME types resolve from the file extension, case-insensitively, and non-audio names resolve to none.');
}

// Pool naming: the zip's name, de-duplicated with a numeric suffix instead of an error.
{
  assert.equal(playlistPoolName('Road Trip.zip',[]),'Road Trip');
  assert.equal(playlistPoolName('Road Trip.ZIP',['Road Trip']),'Road Trip (2)');
  assert.equal(playlistPoolName('Road Trip.zip',['road trip','Road Trip (2)']),'Road Trip (3)','dedupe is case-insensitive, like pool creation');
  assert.equal(playlistPoolName('folder/My Mix.zip',[]),'My Mix','a path-like zip name reduces to its file name');
  assert.equal(playlistPoolName('.zip',[]),'Playlist','an empty base name falls back to Playlist');
  const long='a'.repeat(100)+'.zip';
  assert.equal(playlistPoolName(long,[]).length,80,'pool names respect the 80 character pool limit');
  assert.equal(playlistPoolName(long,['a'.repeat(80)]).length,80,'the dedupe suffix fits inside the same limit');
  console.log('PASS: playlist pool names come from the zip name and de-duplicate with (2), (3) suffixes inside the pool name limit.');
}

// The player queue: the pool's audio members with a URL, in pool order — mixed pools queue only their audio.
{
  const assets=[
    {name:'Cover.png',storageKey:'k-cover',type:'image/png',url:'https://example.test/cover'},
    {name:'Second.mp3',storageKey:'k-2',type:'audio/mpeg',url:'https://example.test/2'},
    {name:'First.mp3',storageKey:'k-1',type:'audio/mpeg',url:'https://example.test/1'},
    {name:'Silent.mp3',storageKey:'k-silent',type:'audio/mpeg'},
    {name:'Clip.mp4',storageKey:'k-clip',type:'video/mp4',url:'https://example.test/clip'},
  ];
  const pool={id:'p1',name:'Mix',assetKeys:['k-1','k-cover','k-2','k-missing','k-silent','k-clip']};
  assert.deepEqual(poolAudioTracks(pool,assets).map(asset=>asset.storageKey),['k-1','k-2'],'pool order wins over library order; images, videos, missing and URL-less members are left out');
  assert.deepEqual(poolAudioTracks({id:'p2',name:'Pics',assetKeys:['k-cover']},assets),[],'a pool with no audio has no queue');
  console.log('PASS: the playlist player queue is the pool\u2019s audio members in pool order, skipping non-audio, missing and unplayable members.');
}

// Zip detection and entry base names.
{
  assert.equal(isZipFileName('mix.zip'),true);
  assert.equal(isZipFileName('mix.ZIP'),true);
  assert.equal(isZipFileName('mix.zipx'),false);
  assert.equal(isZipFileName('song.mp3'),false);
  assert.equal(zipEntryBaseName('Album/Sub/01 Song.mp3'),'01 Song.mp3');
  assert.equal(zipEntryBaseName('01 Song.mp3'),'01 Song.mp3');
  console.log('PASS: zip files are detected by extension and entry paths reduce to their file names.');
}
