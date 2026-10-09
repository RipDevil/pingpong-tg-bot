const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHandler } = require('../src/handler');
const { createLiveWindow } = require('../src/live-window');

function fixture({
  config = {},
  parent,
  message = {},
  sendError,
  parentError,
} = {}) {
  const sent = [];
  const logs = [];
  let fetched = 0;
  let clock = 100000;
  const live = createLiveWindow(() => clock);
  live.resume();
  const handler = createHandler({
    config: { chatId: '-100123', trigger: 'ping', reply: 'pong', ...config },
    selfId: '9007199254740993',
    chatIdOf: (msg) => msg.peerId,
    isLive: (msg) => live.allows(msg),
    log: (text) => logs.push(text),
    client: {
      async sendMessage(peer, options) {
        if (sendError) throw sendError;
        sent.push({ peer, ...options });
      },
    },
  });
  const event = {
    message: {
      id: 42,
      peerId: '-100123',
      message: 'ping',
      date: 100,
      out: false,
      replyTo: { replyToMsgId: 12 },
      async getReplyMessage() {
        fetched += 1;
        if (parentError) throw parentError;
        return parent === undefined
          ? {
              senderId: { toString: () => '9007199254740993' },
              peerId: '-100123',
              message: 'anything',
            }
          : parent;
      },
      ...message,
    },
  };
  return {
    handler,
    event,
    sent,
    logs,
    live,
    fetched: () => fetched,
    setClock: (value) => {
      clock = value;
    },
  };
}

test('replies to the incoming trigger, with plain text, in the same group', async () => {
  const f = fixture();
  await f.handler(f.event);
  assert.deepEqual(f.sent, [
    { peer: '-100123', message: 'pong', replyTo: 42, parseMode: false },
  ]);
});

for (const text of ['PING', '  PiNg\n', '\tping ']) {
  test(`matches the whole trimmed trigger: ${JSON.stringify(text)}`, async () => {
    const f = fixture({ message: { message: text } });
    await f.handler(f.event);
    assert.equal(f.sent.length, 1);
  });
}

test('supports custom trigger and literal response text', async () => {
  const f = fixture({
    config: { trigger: 'knock knock', reply: '**Who is there?**' },
    message: { message: ' KNOCK KNOCK ' },
  });
  await f.handler(f.event);
  assert.equal(f.sent[0].message, '**Who is there?**');
  assert.equal(f.sent[0].parseMode, false);
});

const ignored = [
  ['wrong group', { message: { peerId: '-100456' } }],
  ['outgoing message', { message: { out: true } }],
  ['non-reply', { message: { replyTo: undefined } }],
  ['substring trigger', { message: { message: 'ping please' } }],
  ['empty text', { message: { message: '' } }],
  ['missing text', { message: { message: undefined } }],
  ['historical message', { message: { date: 99 } }],
  ['wrong parent author', { parent: { senderId: '123', peerId: '-100123' } }],
  [
    'parent sent as a channel',
    { parent: { senderId: '-10077', peerId: '-100123' } },
  ],
  ['unavailable parent', { parent: null }],
  [
    'cross-chat parent',
    { parent: { senderId: '9007199254740993', peerId: '-100456' } },
  ],
];
for (const [name, options] of ignored) {
  test(`ignores ${name}`, async () => {
    const f = fixture(options);
    await f.handler(f.event);
    assert.equal(f.sent.length, 0);
  });
}

test('deduplicates concurrent deliveries before fetching the parent', async () => {
  const f = fixture();
  await Promise.all([f.handler(f.event), f.handler(f.event)]);
  assert.equal(f.sent.length, 1);
  assert.equal(f.fetched(), 1);
});

test('ignores disconnected and missed messages, resumes for new messages', async () => {
  const f = fixture();
  f.live.pause();
  await f.handler(f.event);
  f.setClock(200000);
  f.live.resume();
  await f.handler(f.event);
  assert.equal(f.sent.length, 0);
  await f.handler({ message: { ...f.event.message, date: 200, id: 43 } });
  assert.equal(f.sent.length, 1);
});

test('does not send if disconnected while fetching the parent', async () => {
  const f = fixture();
  const fetch = f.event.message.getReplyMessage;
  f.event.message.getReplyMessage = async () => {
    f.live.pause();
    return fetch();
  };
  await f.handler(f.event);
  assert.equal(f.sent.length, 0);
});

for (const failure of ['sendError', 'parentError']) {
  test(`contains ${failure} and continues processing without leaking details`, async () => {
    const f = fixture({ [failure]: new Error('private credentials') });
    await f.handler(f.event);
    await f.handler({ message: { ...f.event.message, id: 43 } });
    assert.equal(f.logs.length, 2);
    assert.ok(f.logs.every((text) => !text.includes('private credentials')));
  });
}
