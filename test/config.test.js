const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readConfig } = require('../src/config');

const env = {
  TELEGRAM_API_ID: '12345',
  TELEGRAM_API_HASH: 'a'.repeat(32),
  TELEGRAM_SESSION: 'session-placeholder',
  TELEGRAM_CHAT_ID: '-1009007199254740993',
};

test('preserves group IDs as strings and defaults ping/pong', () => {
  const config = readConfig('start', env);
  assert.equal(config.chatId, env.TELEGRAM_CHAT_ID);
  assert.equal(config.trigger, 'ping');
  assert.equal(config.reply, 'pong');
});

test('login requires only API credentials; chat listing does not require a group', () => {
  const credentials = {
    TELEGRAM_API_ID: env.TELEGRAM_API_ID,
    TELEGRAM_API_HASH: env.TELEGRAM_API_HASH,
  };
  assert.equal(readConfig('login', credentials).apiId, 12345);
  assert.equal(
    readConfig('chats', {
      ...credentials,
      TELEGRAM_SESSION: env.TELEGRAM_SESSION,
    }).session,
    env.TELEGRAM_SESSION,
  );
});

for (const [name, value] of [
  ['TELEGRAM_API_ID', ''],
  ['TELEGRAM_API_ID', '1.5'],
  ['TELEGRAM_API_ID', '9007199254740993'],
  ['TELEGRAM_API_HASH', 'bad-hash'],
  ['TELEGRAM_SESSION', ''],
  ['TELEGRAM_CHAT_ID', '123'],
  ['TELEGRAM_CHAT_ID', '@group'],
  ['TRIGGER_MESSAGE', '  '],
  ['REPLY_MESSAGE', ''],
  ['REPLY_MESSAGE', 'x'.repeat(4097)],
]) {
  test(`rejects invalid ${name} (${value.length} characters) with actionable errors`, () => {
    assert.throws(
      () => readConfig('start', { ...env, [name]: value }),
      new RegExp(name),
    );
  });
}

test('preserves response formatting and trims trigger whitespace', () => {
  const config = readConfig('start', {
    ...env,
    TRIGGER_MESSAGE: ' knock ',
    REPLY_MESSAGE: '  hello\nthere  ',
  });
  assert.equal(config.trigger, 'knock');
  assert.equal(config.reply, '  hello\nthere  ');
});
