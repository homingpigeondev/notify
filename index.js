'use strict';

// Homing Pigeon GitHub Action. No dependencies: it reads its inputs from the environment the
// runner sets, POSTs to /v1/send and writes its outputs to $GITHUB_OUTPUT.
const fs = require('fs');
const { version } = require('./package.json');

const input = (name) => (process.env[`INPUT_${name.toUpperCase()}`] || '').trim();
const escapeData = (s) => String(s).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
const command = (name, text) => process.stdout.write(`::${name}::${escapeData(text)}\n`);

function setOutput(name, value) {
  const file = process.env.GITHUB_OUTPUT;
  if (file) fs.appendFileSync(file, `${name}=${String(value).replace(/[\r\n]/g, ' ')}\n`);
}

async function run() {
  const failOnError = input('fail-on-error').toLowerCase() === 'true';
  const problem = (text) => {
    command(failOnError ? 'error' : 'warning', `Homing Pigeon: ${text}`);
    if (failOnError) process.exitCode = 1;
  };

  const message = input('message');
  const key = input('api-key') || (process.env.HOMINGPIGEON_API_KEY || '').trim();
  if (key) command('add-mask', key);
  if (!message) return problem('message is empty. Set the message input.');
  if (!key) {
    return problem(
      'no key. Get one by running `npx -y homingpigeondev verify <your phone>` in a terminal or coding agent, ' +
        'then `gh secret set HOMINGPIGEON_API_KEY` with the key from `npx -y homingpigeondev key`, and pass api-key: ${{ secrets.HOMINGPIGEON_API_KEY }}.'
    );
  }

  const body = { message };
  const idem = input('idempotency-key');
  if (idem) body.idempotency_key = idem;

  let res;
  let data;
  try {
    res = await fetch(`${process.env.HOMINGPIGEON_API_URL || 'https://homingpigeon.dev'}/v1/send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'User-Agent': `homingpigeondev/${version} (action)`
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000)
    });
    data = await res.json().catch(() => null);
  } catch {
    return problem('could not reach homingpigeon.dev. The text was not sent.');
  }

  if (!res.ok || !data) {
    const err = (data && data.error) || {};
    return problem(`${err.message || `HTTP ${res.status}`}${err.next_step ? ` ${err.next_step}` : ''}`);
  }

  setOutput('id', data.id || '');
  setOutput('status', data.status || '');
  if (data.messages_remaining !== undefined) setOutput('messages-remaining', data.messages_remaining);
  console.log(`Homing Pigeon: ${data.duplicate ? 'already sent, not repeated' : 'sent'} (${data.id}). ${data.messages_remaining ?? '?'} texts left this month.`);
}

run().catch((err) => {
  command('warning', `Homing Pigeon: ${err.message}`);
});
