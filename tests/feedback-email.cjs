const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
function moduleFrom(file, deps = {}, globals = {}) {
  const exports = {}; const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(code, { exports, require: id => deps[id] || require(id), Request, Response, Headers, TextDecoder, AbortSignal, URL, Date, Math, Set, console, ...globals }, { filename: file }); return exports;
}

(async () => {
  // ---- lib/feedback-email.ts with a stubbed nodemailer -------------------
  const transportOpts = [], sentMail = [];
  let sendMailError = null;
  const createTransport = (opts) => {
    transportOpts.push(opts);
    return { sendMail: async (mail) => { if (sendMailError) throw sendMailError; sentMail.push(mail); return { messageId: 'test-id' }; } };
  };
  const nodemailerStub = { createTransport, default: { createTransport } };
  const quietConsole = { ...console, error: () => {} };
  const email = moduleFrom('lib/feedback-email.ts', { nodemailer: nodemailerStub }, { console: quietConsole });

  assert.equal(email.FEEDBACK_RECIPIENT, 'jessica@ttcgamelab.com', 'feedback always goes to the fixed admin address');

  // Not configured: no env at all -> clean report, no throw, no transport.
  assert.equal(email.feedbackEmailConfigured({}), false);
  assert.equal(email.feedbackEmailSettings({}), null);
  let result = await email.sendFeedbackEmail({ fromEmail: 'user@example.test', topic: 'Comment', page: '/projects', message: 'Hello there.' }, {});
  assert.equal(result.sent, false); assert.equal(result.reason, 'not-configured');
  assert.equal(transportOpts.length, 0, 'no SMTP transport is created when unconfigured');

  // Partially configured (missing password / bad port) is also not configured.
  assert.equal(email.feedbackEmailConfigured({ FEEDBACK_SMTP_HOST: 'mail.example.test', FEEDBACK_SMTP_PORT: '587', FEEDBACK_SMTP_USER: 'site@example.test' }), false);
  result = await email.sendFeedbackEmail({ fromEmail: 'user@example.test', topic: 'Other', page: '', message: 'Still saved.' }, { FEEDBACK_SMTP_HOST: 'mail.example.test', FEEDBACK_SMTP_PORT: 'nope', FEEDBACK_SMTP_USER: 'site@example.test', FEEDBACK_SMTP_PASS: 'secret' });
  assert.equal(result.sent, false); assert.equal(result.reason, 'not-configured');
  assert.equal(transportOpts.length, 0);

  // Configured for port 587: STARTTLS shape, fixed recipient, full body.
  const env587 = { FEEDBACK_SMTP_HOST: 'mail.example.test', FEEDBACK_SMTP_PORT: '587', FEEDBACK_SMTP_USER: 'site@example.test', FEEDBACK_SMTP_PASS: 'secret' };
  assert.equal(email.feedbackEmailConfigured(env587), true);
  result = await email.sendFeedbackEmail({ fromEmail: 'user@example.test', topic: 'Request', page: '/project/abc', message: 'Please add a dark mode.' }, env587);
  assert.equal(result.sent, true);
  assert.equal(transportOpts.length, 1);
  assert.equal(transportOpts[0].host, 'mail.example.test');
  assert.equal(transportOpts[0].port, 587);
  assert.equal(transportOpts[0].secure, false, 'port 587 must not use implicit TLS');
  assert.equal(transportOpts[0].requireTLS, true, 'port 587 must require STARTTLS');
  assert.equal(transportOpts[0].auth.user, 'site@example.test');
  assert.equal(transportOpts[0].auth.pass, 'secret');
  assert.equal(sentMail.length, 1);
  assert.equal(sentMail[0].to, 'jessica@ttcgamelab.com');
  assert.equal(sentMail[0].from, 'site@example.test', 'From defaults to the SMTP user');
  assert.equal(sentMail[0].replyTo, 'user@example.test');
  assert.equal(sentMail[0].subject, '[TTC Game Lab feedback] Request');
  assert(sentMail[0].text.includes('user@example.test'), 'body names the submitting account email');
  assert(sentMail[0].text.includes('Request'), 'body names the topic');
  assert(sentMail[0].text.includes('/project/abc'), 'body names the page');
  assert(sentMail[0].text.includes('Please add a dark mode.'), 'body carries the message verbatim');

  // Port 465 uses implicit TLS; FEEDBACK_EMAIL_FROM overrides the From.
  const env465 = { ...env587, FEEDBACK_SMTP_PORT: '465', FEEDBACK_EMAIL_FROM: 'feedback@example.test' };
  result = await email.sendFeedbackEmail({ fromEmail: 'user@example.test', topic: 'Comment', page: '/help', message: 'Love the new stage.' }, env465);
  assert.equal(result.sent, true);
  assert.equal(transportOpts.at(-1).secure, true, 'port 465 uses implicit TLS');
  assert.equal(sentMail.at(-1).from, 'feedback@example.test');

  // A failing SMTP server is reported, never thrown.
  sendMailError = new Error('connection refused');
  result = await email.sendFeedbackEmail({ fromEmail: 'user@example.test', topic: 'Site issue', page: '/', message: 'It broke.' }, env587);
  assert.equal(result.sent, false); assert.equal(result.reason, 'send-failed');
  sendMailError = null;

  // ---- app/api/help/route.ts with stubbed auth, db and email -------------
  let currentUser = { id: 'user-1', email: 'user@example.test' };
  let recentCount = 0, lastId = 0;
  const saved = [], emailCalls = [];
  function fakeDb(strings, ...values) {
    const text = strings.join(' ');
    if (text.includes('COUNT(*)')) return Promise.resolve([{ total: recentCount }]);
    if (text.includes('INSERT INTO support_messages')) { saved.push(values); return Promise.resolve([{ id: ++lastId }]); }
    return Promise.resolve([]);
  }
  const route = moduleFrom('app/api/help/route.ts', {
    'next/server': { NextResponse: { json: (body, options) => Response.json(body, options) } },
    '../../../lib/auth/server': { requireCreator: async () => currentUser, isAdmin: () => false },
    '../../../lib/db': { getDb: () => fakeDb },
    '../../../lib/feedback-email': { sendFeedbackEmail: async (input) => { emailCalls.push(input); return { sent: false, reason: 'not-configured' }; } },
  });
  async function post(body) {
    return route.POST(new Request('https://example.test/api/help', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
  }

  // Every accepted topic — the original three plus the widened three —
  // saves first and attempts the admin email with the same values.
  for (const topic of ['Site issue', 'Concern', 'Recommendation', 'Comment', 'Request', 'Other']) {
    saved.length = 0; emailCalls.length = 0;
    const response = await post({ topic, message: `A message about ${topic}.`, page: '/projects' });
    assert.equal(response.status, 200, `topic ${topic} is accepted`);
    assert.equal(typeof (await response.json()).id, 'number');
    assert.equal(saved.length, 1, `topic ${topic} is saved to the inbox`);
    assert.equal(saved[0][2], topic, 'the saved row carries the topic');
    assert.equal(emailCalls.length, 1, `topic ${topic} attempts the admin email after saving`);
    assert.equal(emailCalls[0].topic, topic);
    assert.equal(emailCalls[0].fromEmail, 'user@example.test');
    assert.equal(emailCalls[0].page, '/projects');
    assert.equal(emailCalls[0].message, `A message about ${topic}.`);
  }

  // An email that cannot be sent (here: SMTP not configured) never fails
  // the submission — the 200s above already prove it, since the stub
  // reports not-configured for every call.

  // Unknown topics and short messages are refused and touch nothing.
  saved.length = 0; emailCalls.length = 0;
  let response = await post({ topic: 'Nonsense', message: 'A perfectly long message.' });
  assert.equal(response.status, 400);
  response = await post({ topic: 'Comment', message: 'hi' });
  assert.equal(response.status, 400);
  assert.equal(saved.length, 0);
  assert.equal(emailCalls.length, 0);

  // Signed-out users are refused before anything is saved or emailed.
  currentUser = null;
  response = await post({ topic: 'Comment', message: 'A perfectly long message.' });
  assert.equal(response.status, 401);
  assert.equal(saved.length, 0);
  assert.equal(emailCalls.length, 0);
  currentUser = { id: 'user-1', email: 'user@example.test' };

  // ---- Header wiring (source-level) ---------------------------------------
  const header = fs.readFileSync('components/SiteHeader.tsx', 'utf8');
  assert(header.includes('authClient.useSession()'), 'the header learns sign-in state from the auth client session');
  assert(header.includes('signedIn && <SubmitFeedback />'), 'the feedback button renders only for signed-in users');
  const dialog = fs.readFileSync('components/SubmitFeedback.tsx', 'utf8');
  for (const label of ['"Issue"', '"Comment"', '"Request"', '"Other"']) assert(dialog.includes(`label: ${label}`), `the dialog offers the ${label} kind`);
  assert(dialog.includes('"/api/help"') || dialog.includes("'/api/help'") || dialog.includes('"/api/help"'), 'the dialog posts to /api/help');
  assert(dialog.includes('window.location.pathname'), 'the dialog includes the page the user was on');
  assert(dialog.includes('confirm-dialog'), 'the dialog follows the in-page ConfirmDialog styling');

  console.log('PASS: feedback topics widened with originals intact, save-first email to the fixed admin address, not-configured and send-failure paths stay clean, header button is signed-in only.');
})().catch((e) => { console.error(e); process.exitCode = 1; });
