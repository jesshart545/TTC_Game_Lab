const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function moduleFrom(file, dependencies = {}, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(code, { exports, require: id => dependencies[id] || require(id), URL, URLSearchParams, Buffer, Request, Response, Headers, AbortSignal, TextDecoder, console, Date, ...globals });
  return exports;
}
const shared = moduleFrom('lib/web-research.ts');
const web = moduleFrom('lib/web-search.ts');
let creator = { id: 'creator-one' }, dbAvailable = true, count = 1;
const sqlCalls = [];
const sql = async (parts, ...values) => {
  const query = parts.join('?'); sqlCalls.push({ query, values });
  if (query.includes('SELECT id FROM projects')) return [{ id: 'project-one' }];
  if (query.includes('RETURNING count')) return [{ count }];
  if (query.includes('CREATE TABLE')) return [];
  throw new Error('Unexpected SQL: ' + query);
};
const server = moduleFrom('lib/web-research-server.ts', {
  './auth/server': { requireCreator: async () => creator }, './db': { getDb: () => dbAvailable ? sql : null },
  './youtube-server': { validLiveHost: async (_db, _id, key) => key === 'a'.repeat(64) },
});
const secret = 'test-search-service-key-not-production';
const now = Date.now();
const sources = [
  { title: 'Primary report', url: 'https://primary.example/fact', summary: 'The official count is 12. It was measured in 2024.' },
  { title: 'Reference report', url: 'https://reference.example/check', summary: 'The count is 12 according to the agency.' },
];
const signed = sources.map(source => server.signResearchSource(source, 'user:creator-one', secret, now));
assert.equal(server.checkedResearchSources(signed, 'user:creator-one', secret, now).length, 2);
assert.throws(() => server.checkedResearchSources(signed, 'user:other', secret, now));
assert.throws(() => server.checkedResearchSources(signed, 'user:creator-one', 'wrong', now));
assert.throws(() => server.checkedResearchSources(signed, 'user:creator-one', secret, now + 3600001));
assert.throws(() => server.checkedResearchSources([{ ...signed[0], summary: 'Fabricated evidence' }], 'user:creator-one', secret, now));
assert.throws(() => server.checkedResearchSources([{ ...signed[0], url: 'https://fake.example/' }], 'user:creator-one', secret, now));
assert.throws(() => server.checkedResearchSources([{ ...signed[0], evidenceToken: 'not-a-token' }], 'user:creator-one', secret, now));
assert.throws(() => server.checkedResearchSources([signed[0], signed[0]], 'user:creator-one', secret, now));
const literal = server.signResearchSource({ ...sources[0], title: 'Literal <tag>', summary: 'A literal <word> survives evidence validation.' }, 'user:creator-one', secret, now);
assert.equal(server.checkedResearchSources([literal], 'user:creator-one', secret, now)[0].summary, literal.summary);
const valid = { verdict: 'supported', summary: 'Both supplied excerpts report 12.', findings: [{ text: 'Both excerpts report 12.', sourceIds: [0, 1] }], evidence: [{ sourceId: 0, quote: 'The official count is 12.' }, { sourceId: 1, quote: 'The count is 12' }], limitation: 'These are snippets, not independent verification.' };
assert.equal(server.checkedResearchAnalysis(valid, sources, 'fact-check').verdict, 'supported');
assert.throws(() => server.checkedResearchAnalysis({ ...valid, evidence: [{ sourceId: 0, quote: 'This was never in the source.' }] }, sources, 'general'));
assert.throws(() => server.checkedResearchAnalysis({ ...valid, findings: [{ text: 'Wrong source', sourceIds: [9] }] }, sources, 'general'));
assert.throws(() => server.checkedResearchAnalysis({ ...valid, evidence: [] }, sources, 'general'));
assert.throws(() => server.checkedResearchAnalysis({ ...valid, verdict: 'verified' }, sources, 'general'));
assert.throws(() => server.checkedResearchAnalysis({ ...valid, verdict: 'conflicting', findings: [{ text: 'Conflict', sourceIds: [0] }], evidence: [valid.evidence[0]] }, sources, 'general'));
assert.throws(() => server.checkedResearchAnalysis(valid, [sources[0], { ...sources[1], url: 'https://www.primary.example/other' }], 'fact-check'));
assert.throws(() => server.checkedResearchAnalysis(valid, sources, 'music'));
assert.equal(server.checkedResearchAnalysis({ verdict: 'overview', summary: 'Use the listed music reference links.', findings: [{ text: 'A source reference is available.', sourceIds: [0] }], evidence: [], limitation: 'Usage rights must be checked.' }, sources, 'music').verdict, 'overview');

const memory = new Map(); let blocked = false;
const notes = moduleFrom('lib/web-research.ts', {}, { window: { localStorage: { getItem: key => { if (blocked) throw new Error('blocked'); return memory.get(key) || null; }, setItem: (key, value) => { if (blocked) throw new Error('blocked'); memory.set(key, value); } } } });
const note = { id: 'one', title: 'Private finding', text: 'Kept in this browser.', url: 'https://primary.example/fact', createdAt: now, hostKey: 'must-not-store', evidenceToken: 'must-not-store-either' };
assert.equal(notes.writeResearchNotes('live:one', [note]), true);
assert.equal(notes.readResearchNotes('live:one').notes.length, 1);
assert.equal(notes.readResearchNotes('live:two').notes.length, 0);
assert(!memory.get(notes.researchNotesKey('live:one')).includes('must-not-store'));
assert.equal(notes.normalizeResearchNotes([{ ...note, url: 'javascript:alert(1)' }])[0].url, undefined);
assert.equal(notes.normalizeResearchNotes(Array.from({ length: 35 }, (_, i) => ({ ...note, id: String(i) }))).length, 30);
blocked = true; assert.equal(notes.writeResearchNotes('live:one', [note]), false); assert.equal(notes.readResearchNotes('live:one').unavailable, true); blocked = false;
memory.set(notes.researchNotesKey('bad'), 'not-json'); assert.equal(notes.readResearchNotes('bad').unavailable, true);

const env = { SEARCH_SERVICE_KEY: secret, AGNES_API_KEY: 'test-model-key-not-production', AGNES_MODEL: 'configured-test-model', SEARCH_INTERNAL_URL: 'https://test-search.example' };
const fetchCalls = []; let providerReply = valid, providerOk = true;
const fetchMock = async (url, options) => { fetchCalls.push({ url, options }); return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(providerReply) } }] }), { status: providerOk ? 200 : 502 }); };
const deps = { 'next/server': { NextResponse: { json: (body, options = {}) => new Response(JSON.stringify(body), { status: options.status || 200, headers: options.headers }) } }, '../../../lib/web-research': shared, '../../../lib/web-research-server': server };
const route = moduleFrom('app/api/web-research/route.ts', deps, { process: { env }, fetch: fetchMock });
const request = (body, headers = {}) => new Request('https://app.example/api/web-research', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
(async () => {
  const owner = await server.researchAccess(request({}), undefined); assert.equal(owner.identity, 'user:creator-one');
  creator = null;
  assert.equal((await server.researchAccess(request({}), undefined)).status, 401);
  assert.equal((await server.researchAccess(request({}, { 'x-host-key': 'a'.repeat(64) }), 'live-game')).identity, 'host:project-one');
  assert.equal((await server.researchAccess(request({}, { 'x-host-key': 'b'.repeat(64) }), 'live-game')).status, 401);
  dbAvailable = false; assert.equal((await server.researchAccess(request({}), undefined)).status, 503); dbAvailable = true;
  creator = { id: 'creator-one' };
  count = 21; assert.equal(await server.researchLimit(owner, 'search'), false); count = 6; assert.equal(await server.researchLimit(owner, 'analysis'), false); count = 1;
  const body = { q: 'What count do the supplied snippets report?', purpose: 'fact-check', sources: signed };
  let response = await route.POST(request(body)); assert.equal(response.status, 200);
  let data = await response.json(); assert.equal(data.analysis.verdict, 'supported'); assert.equal(data.sources[0].url, sources[0].url); assert(!JSON.stringify(data).includes('evidenceToken')); assert.equal(response.headers.get('cache-control'), 'no-store');
  const sent = JSON.parse(fetchCalls[0].options.body); assert.equal(sent.model, 'configured-test-model'); assert(!JSON.stringify(sent.messages).includes('evidenceToken')); assert(!('tools' in sent));
  const before = fetchCalls.length;
  response = await route.POST(request({ ...body, sources: [{ ...signed[0], summary: 'Forged' }, signed[1]] })); assert.equal(response.status, 400); assert.equal(fetchCalls.length, before);
  creator = null; response = await route.POST(request(body)); assert.equal(response.status, 401); assert.equal(fetchCalls.length, before); creator = { id: 'creator-one' };
  const sameDomain = server.signResearchSource({ ...sources[1], url: 'https://primary.example/second' }, 'user:creator-one', secret);
  response = await route.POST(request({ ...body, sources: [signed[0], sameDomain] })); assert.equal(response.status, 200); assert.equal((await response.json()).analysis.verdict, 'insufficient'); assert.equal(fetchCalls.length, before);
  delete env.AGNES_API_KEY; response = await route.POST(request(body)); assert.equal(response.status, 503); assert.equal(fetchCalls.length, before); env.AGNES_API_KEY = 'test-model-key-not-production';
  count = 6; response = await route.POST(request(body)); assert.equal(response.status, 429); count = 1;
  providerReply = { ...valid, evidence: [{ sourceId: 0, quote: 'Fabricated quote' }] }; response = await route.POST(request(body)); assert.equal(response.status, 502); providerReply = valid;
  providerOk = false; response = await route.POST(request(body)); assert.equal(response.status, 502); providerOk = true;
  response = await route.POST(request({ ...body, q: 'x'.repeat(201) })); assert.equal(response.status, 400);
  response = await route.POST(request({ ...body, padding: 'x'.repeat(50000) })); assert.equal(response.status, 400);
  assert(sqlCalls.every(call => call.query.includes('web_search_limits') || call.query.startsWith('SELECT id FROM projects')), 'Research never edits projects, live state or snapshots.');
  assert(fetchCalls.every(call => call.url === 'https://apihub.agnes-ai.com/v1/chat/completions'), 'Analysis calls no live, generation, playback or source-page endpoints.');

  const searches = [];
  const searchRoute = moduleFrom('app/api/web-search/route.ts', { ...deps, '../../../lib/web-search': web }, { process: { env }, fetch: async (url, options) => {
    searches.push({ url: String(url), options });
    return new Response(JSON.stringify({ results: sources.map(source => ({ title: source.title, url: source.url, content: source.summary })) }));
  } });
  response = await searchRoute.POST(request({ q: 'Any unrestricted general query' })); assert.equal(response.status, 200);
  data = await response.json(); assert.equal(data.results.length, 2); assert.equal(data.results[0].summary, sources[0].summary);
  assert.equal(server.checkedResearchSources(data.results, 'user:creator-one', secret).length, 2);
  assert.equal(new URL(searches[0].url).searchParams.get('categories'), 'general');
  assert.equal(new URL(searches[0].url).searchParams.get('q'), 'Any unrestricted general query');
  const searchCount = searches.length; creator = null;
  response = await searchRoute.POST(request({ q: 'Private search' })); assert.equal(response.status, 401); assert.equal(searches.length, searchCount);
  creator = { id: 'creator-one' }; count = 21;
  response = await searchRoute.POST(request({ q: 'Rate limited' })); assert.equal(response.status, 429); assert.equal(searches.length, searchCount); count = 1;
  const base = env.SEARCH_INTERNAL_URL; delete env.SEARCH_INTERNAL_URL;
  response = await searchRoute.POST(request({ q: 'Missing provider' })); assert.equal(response.status, 503); assert.equal(searches.length, searchCount); env.SEARCH_INTERNAL_URL = base;
  response = await searchRoute.POST(request({ q: 'x'.repeat(201) })); assert.equal(response.status, 400);
  const proxy = fs.readFileSync('proxy.ts', 'utf8'); assert(proxy.match(/api\/web-research/g).length === 2, 'Main-origin and project-domain routing must support the authenticated research API.');
  console.log('PASS: private creator/host authentication, signed per-identity current evidence, exact citations, uncertainty/music bounds, bounded private notes, rate limits, read-only analysis, configured model, and graceful failures with no real API calls.');
})().catch(error => { console.error(error); process.exitCode = 1; });
