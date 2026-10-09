const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const dotenv = require('dotenv');
const { saveSession } = require('../src/session');

async function temporaryEnv(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pingpong-test-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return path.join(directory, '.env');
}

test('updates the session atomically and preserves configuration and comments', async (t) => {
  const file = await temporaryEnv(t);
  await fs.writeFile(
    file,
    '# keep comment\r\nTELEGRAM_API_ID=123\r\nTELEGRAM_SESSION=old\r\nREPLY_MESSAGE="hello # friend"\r\nexport TELEGRAM_SESSION=duplicate\r\n',
  );
  await saveSession(file, '1new-session+=');
  const text = await fs.readFile(file, 'utf8');
  const values = dotenv.parse(text);
  assert.equal(values.TELEGRAM_SESSION, '1new-session+=');
  assert.equal(values.TELEGRAM_API_ID, '123');
  assert.equal(values.REPLY_MESSAGE, 'hello # friend');
  assert.ok(text.includes('# keep comment'));
  assert.equal(text.match(/TELEGRAM_SESSION=/g).length, 1);
  if (process.platform !== 'win32')
    assert.equal((await fs.stat(file)).mode & 0o777, 0o600);
  assert.deepEqual(await fs.readdir(path.dirname(file)), ['.env']);
});

test('creates a missing env file', async (t) => {
  const file = await temporaryEnv(t);
  await saveSession(file, '1new-session');
  assert.equal(
    dotenv.parse(await fs.readFile(file)).TELEGRAM_SESSION,
    '1new-session',
  );
});

test('rejects empty or multiline session values without changing the file', async (t) => {
  const file = await temporaryEnv(t);
  await fs.writeFile(file, 'TELEGRAM_API_ID=123\n');
  for (const invalid of ['', 'session\nINJECTED=value']) {
    await assert.rejects(saveSession(file, invalid));
  }
  assert.equal(await fs.readFile(file, 'utf8'), 'TELEGRAM_API_ID=123\n');
});
