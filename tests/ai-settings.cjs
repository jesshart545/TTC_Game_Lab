const assert=require('node:assert/strict'),load=require('./load.cjs'),{validateExplicitSettings}=load('lib/ai-edit-validation.ts');
const request='Add Team Scores at x 70%, y 10%, width 25%, height 50%. Use Georgia and a dark purple background.';
assert.throws(()=>validateExplicitSettings(request,{changes:{newTools:[{config:{entries:[{name:'A'}]}}]}}),/requested x/);
const full={changes:{newTools:[{config:{placement:{x:70,y:10,width:25,height:50},appearance:{fontFamily:'Georgia, serif',backgroundColor:'#330066'}}}]}};
validateExplicitSettings(request,full);
assert.throws(()=>validateExplicitSettings('Set the background color to #abcdef',full),/requested color/);
validateExplicitSettings('Place at x 960px, width 480px',{changes:{controls:[{overlayResult:{x:50,width:25}}]}});
validateExplicitSettings('Write a short script about Georgia',{reply:'A script',changes:{}});
console.log('PASS: AI responses missing explicit dimensions, fonts or colors are rejected for repair; pixel requests use the 1920x1080 canvas; writing remains available.');
