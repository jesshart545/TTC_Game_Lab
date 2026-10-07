const assert=require('node:assert/strict'),{groundedResearchCards}=require('./load.cjs')('lib/research-cards.ts');
const evidence=[{url:'https://example.com',title:'Instrument source',summary:'A standard violin has four strings. They are tuned G, D, A and E.'}];
const changes={newTools:[{type:'card-list',config:{cards:[{text:'Invented embellishment',sourceUrl:evidence[0].url,sourceQuote:'A standard violin has four strings.'}]}}]};
const grounded=groundedResearchCards(changes,evidence).newTools[0].config.cards[0];
assert.equal(grounded.text,'A standard violin has four strings.');assert.equal(grounded.sourceTitle,'Instrument source');
assert.throws(()=>groundedResearchCards({newTools:[{type:'card-list',config:{cards:[{sourceUrl:evidence[0].url,sourceQuote:'A piano contains 12 million parts.'}]}}]},evidence),/copied exactly/);
assert.throws(()=>groundedResearchCards({newTools:[{type:'card-list',config:{cards:[{sourceUrl:'https://invented.example',sourceQuote:evidence[0].summary}]}}]},evidence),/copied exactly/);
console.log('PASS: researched pools reject fabricated links and unsupported details; saved card text comes from its actual source excerpt.');
