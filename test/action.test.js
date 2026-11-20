'use strict';

const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { test, before, after } = require('node:test');

let server;
let url;
const calls = [];

before(async () => {
  server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      calls.push({ url: req.url, auth: req.headers.authorization, ua: req.headers['user-agent'], body: JSON.parse(raw || '{}') });
      res.writeHead(req.headers.authorization === 'Bearer hp_good' ? 202 : 401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(req.headers.authorization === 'Bearer hp_good'
        ? { id: 'msg_1', status: 'queued', messages_remaining: 41 }
        : { error: { code: 'invalid_api_key', message: 'This API key is not valid.', next_step: 'Get a new key.' } }));
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  url = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

function run(inputs, extra = {}) {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'hp-action-')), 'output');
  fs.writeFileSync(out, '');
  const env = { PATH: process.env.PATH, HOMINGPIGEON_API_URL: url, GITHUB_OUTPUT: out, ...extra };
  for (const [k, v] of Object.entries(inputs)) env[`INPUT_${k.toUpperCase()}`] = v;
  return new Promise((resolve) =>
    execFile(process.execPath, [path.join(__dirname, '..', 'index.js')], { env }, (err, stdout) =>
      resolve({ code: err ? err.code : 0, stdout, outputs: fs.readFileSync(out, 'utf8') })
    )
  );
}

test('sends the message with the key, masks the key and sets outputs', async () => {
  const r = await run({ message: 'Deploy failed on main', 'api-key': 'hp_good', 'idempotency-key': 'run-1' });
  assert.equal(r.code, 0);
  const call = calls.at(-1);
  assert.equal(call.url, '/v1/send');
  assert.equal(call.auth, 'Bearer hp_good');
  assert.match(call.ua, /^homingpigeondev\/[\d.]+ \(action\)$/);
  assert.deepEqual(call.body, { message: 'Deploy failed on main', idempotency_key: 'run-1' });
  assert.match(r.stdout, /::add-mask::hp_good/);
  assert.match(r.outputs, /^id=msg_1$/m);
  assert.match(r.outputs, /^status=queued$/m);
  assert.match(r.outputs, /^messages-remaining=41$/m);
});

test('falls back to the HOMINGPIGEON_API_KEY environment variable', async () => {
  const r = await run({ message: 'hi' }, { HOMINGPIGEON_API_KEY: 'hp_good' });
  assert.equal(r.code, 0);
  assert.equal(calls.at(-1).auth, 'Bearer hp_good');
});

test('a failed send is a warning by default and an error with fail-on-error', async () => {
  const soft = await run({ message: 'hi', 'api-key': 'hp_bad' });
  assert.equal(soft.code, 0);
  assert.match(soft.stdout, /::warning::Homing Pigeon: This API key is not valid. Get a new key./);
  const hard = await run({ message: 'hi', 'api-key': 'hp_bad', 'fail-on-error': 'true' });
  assert.equal(hard.code, 1);
  assert.match(hard.stdout, /::error::/);
});

test('missing key or message never calls the API', async () => {
  const before = calls.length;
  const noKey = await run({ message: 'hi' });
  assert.match(noKey.stdout, /::warning::Homing Pigeon: no key/);
  const noMessage = await run({ 'api-key': 'hp_good' });
  assert.match(noMessage.stdout, /message is empty/);
  assert.equal(calls.length, before);
});
