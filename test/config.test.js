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
  assert.equal(config.replyDelayMinMs, 1000);
  assert.equal(config.replyDelayMaxMs, 3000);
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

test('parses broad delay ranges in milliseconds, seconds, minutes, and hours', () => {
  for (const [min, max, expectedMin, expectedMax] of [
    ['1s', '3s', 1000, 3000],
    ['1s', '1h', 1000, 3600000],
    ['2h', '4h', 7200000, 14400000],
    ['0ms', '30m', 0, 1800000],
    [' 500ms ', '500ms', 500, 500],
    ['0ms', '2147483647ms', 0, 2147483647],
  ]) {
    const config = readConfig('start', {
      ...env,
      REPLY_DELAY_MIN: min,
      REPLY_DELAY_MAX: max,
    });
    assert.equal(config.replyDelayMinMs, expectedMin);
    assert.equal(config.replyDelayMaxMs, expectedMax);
  }
});

for (const name of ['REPLY_DELAY_MIN', 'REPLY_DELAY_MAX']) {
  test(`rejects invalid durations for ${name}`, () => {
    for (const value of [
      '',
      '-1s',
      '1.5h',
      '1',
      'NaN',
      '1d',
      '1seconds',
      '2147483648ms',
      '597h',
      '9'.repeat(50) + 'h',
    ]) {
      assert.throws(
        () => readConfig('start', { ...env, [name]: value }),
        new RegExp(name),
      );
    }
  });
}

test('rejects reversed ranges; unrelated commands do not require delay settings', () => {
  assert.throws(
    () =>
      readConfig('start', {
        ...env,
        REPLY_DELAY_MIN: '4h',
        REPLY_DELAY_MAX: '2h',
      }),
    /REPLY_DELAY_MIN must not exceed REPLY_DELAY_MAX/,
  );
  assert.equal(
    readConfig('login', { ...env, REPLY_DELAY_MIN: 'bad' }).apiId,
    12345,
  );
  assert.equal(
    readConfig('chats', { ...env, REPLY_DELAY_MAX: 'bad' }).apiId,
    12345,
  );
});
