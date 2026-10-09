const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHandler } = require('../src/handler');
const { createLiveWindow } = require('../src/live-window');
const { createFakeTimers } = require('./support/fake-timers.cjs');

function fixture({
  config = {},
  parent,
  message = {},
  sendError,
  parentError,
  fetchError,
} = {}) {
  const sent = [];
  const logs = [];
  let fetched = 0;
  let clock = 100000;
  const timers = createFakeTimers();
  const messages = new Map();
  const live = createLiveWindow(() => clock);
  live.resume();
  const enqueueHandler = createHandler({
    config: {
      chatId: '-100123',
      trigger: 'ping',
      reply: 'pong',
      replyDelayMinMs: 0,
      replyDelayMaxMs: 0,
      ...config,
    },
    selfId: '9007199254740993',
    chatIdOf: (msg) => msg.peerId,
    isLive: (msg) => live.allows(msg),
    log: (text) => logs.push(text),
    timers: timers.options,
    client: {
      async getMessages(peer, { ids }) {
        if (fetchError) throw fetchError;
        return ids.map((id) => messages.get(id));
      },
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
  const enqueue = async (incoming) => {
    messages.set(incoming.message.id, incoming.message);
    await enqueueHandler(incoming);
  };
  const handler = async (incoming) => {
    await enqueue(incoming);
    await timers.advance(0);
  };
  return {
    handler,
    enqueue,
    cancel: enqueueHandler.cancelPending,
    timers,
    messages,
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
  // One initial lookup and one fresh lookup before the single send.
  assert.equal(f.fetched(), 2);
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

for (const failure of ['sendError', 'parentError', 'fetchError']) {
  test(`contains ${failure} and continues processing without leaking details`, async () => {
    const f = fixture({ [failure]: new Error('private credentials') });
    await f.handler(f.event);
    await f.handler({ message: { ...f.event.message, id: 43 } });
    assert.equal(f.logs.length, 2);
    assert.ok(f.logs.every((text) => !text.includes('private credentials')));
  });
}

test('group-wide debounce sends only the latest ping, even from another sender', async () => {
  const f = fixture({
    config: { replyDelayMinMs: 1000, replyDelayMaxMs: 1000 },
  });
  await f.enqueue(f.event);
  assert.equal(f.sent.length, 0);
  await f.timers.advance(500);
  await f.enqueue({
    message: { ...f.event.message, id: 43, senderId: 'another-friend' },
  });
  await f.timers.advance(999);
  assert.equal(f.sent.length, 0);
  await f.timers.advance(1);
  assert.equal(f.sent.length, 1);
  assert.equal(f.sent[0].replyTo, 43);
});

test('nonqualifying messages and duplicate deliveries do not reset a pending timer', async () => {
  const f = fixture({
    config: { replyDelayMinMs: 1000, replyDelayMaxMs: 1000 },
  });
  await f.enqueue(f.event);
  await f.timers.advance(500);
  await f.enqueue(f.event);
  await f.enqueue({
    message: { ...f.event.message, id: 43, message: 'hello' },
  });
  await f.enqueue({
    message: {
      ...f.event.message,
      id: 44,
      getReplyMessage: async () => ({
        senderId: 'someone-else',
        peerId: '-100123',
      }),
    },
  });
  assert.equal(f.timers.nextDelay, 500);
  await f.timers.advance(500);
  assert.equal(f.sent[0].replyTo, 42);
});

test('an older ping whose validation finishes later cannot replace the latest ping', async () => {
  const f = fixture();
  const fetchParent = f.event.message.getReplyMessage;
  const pending = Promise.withResolvers();
  const older = f.enqueue({
    message: { ...f.event.message, getReplyMessage: () => pending.promise },
  });
  await f.enqueue({ message: { ...f.event.message, id: 43 } });
  pending.resolve(await fetchParent());
  await older;
  await f.timers.advance(0);
  assert.equal(f.sent.length, 1);
  assert.equal(f.sent[0].replyTo, 43);
});

test('cancellation during initial validation prevents rearming after an immediate reconnect', async () => {
  const f = fixture();
  const parent = await f.event.message.getReplyMessage();
  const pending = Promise.withResolvers();
  f.event.message.getReplyMessage = () => pending.promise;
  const validation = f.enqueue(f.event);
  f.cancel();
  f.live.pause();
  f.live.resume();
  pending.resolve(parent);
  await validation;
  assert.equal(f.timers.pending, 0);
  assert.equal(f.sent.length, 0);
});

for (const [name, replacement] of [
  ['deleted trigger', () => undefined],
  ['edited trigger text', (msg) => ({ ...msg, message: 'no longer ping' })],
  ['removed reply reference', (msg) => ({ ...msg, replyTo: undefined })],
  [
    'deleted parent',
    (msg) => ({ ...msg, getReplyMessage: async () => undefined }),
  ],
  [
    'changed parent author',
    (msg) => ({
      ...msg,
      getReplyMessage: async () => ({ senderId: 'other', peerId: '-100123' }),
    }),
  ],
]) {
  test(`revalidation skips ${name}`, async () => {
    const f = fixture();
    await f.enqueue(f.event);
    f.messages.set(42, replacement(f.event.message));
    await f.timers.advance(0);
    assert.equal(f.sent.length, 0);
    assert.equal(f.logs.length, 0);
  });
}

for (const action of ['replace', 'cancel']) {
  test(`${action} during final validation prevents the stale reply`, async () => {
    const f = fixture({
      config: { replyDelayMinMs: 1000, replyDelayMaxMs: 1000 },
    });
    const parent = await f.event.message.getReplyMessage();
    await f.enqueue(f.event);
    const started = Promise.withResolvers();
    const pending = Promise.withResolvers();
    f.messages.set(42, {
      ...f.event.message,
      getReplyMessage: () => {
        started.resolve();
        return pending.promise;
      },
    });
    const firing = f.timers.advance(1000);
    await started.promise;
    if (action === 'replace')
      await f.enqueue({ message: { ...f.event.message, id: 43 } });
    else f.cancel();
    pending.resolve(parent);
    await firing;
    assert.equal(f.sent.length, 0);
    await f.timers.advance(1000);
    assert.equal(f.sent.length, action === 'replace' ? 1 : 0);
    if (action === 'replace') assert.equal(f.sent[0].replyTo, 43);
  });
}
