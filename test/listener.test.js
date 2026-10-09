const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { Api, utils } = require('teleproto');
const { NewMessage } = require('teleproto/events');
const { installListener } = require('../src/listener');
const { createClient, connectAuthorized } = require('../src/client');

before(async () => {
  // Constructing a client installs the library's message conveniences on Api.
  // This stays offline and also exercises cleanup before a connection exists.
  const client = createClient({ apiId: 123, apiHash: 'a'.repeat(32) });
  assert.ok(!client.connected);
  await client.destroy();
});

function fixture() {
  const callbacks = {};
  const sent = [];
  let handler;
  let builder;
  const client = {
    onDisconnect(fn) {
      callbacks.disconnect = fn;
    },
    onReconnecting(fn) {
      callbacks.reconnecting = fn;
    },
    onReconnect(fn) {
      callbacks.reconnect = fn;
    },
    addEventHandler(fn, eventBuilder) {
      handler = fn;
      builder = eventBuilder;
    },
    async sendMessage(peer, options) {
      sent.push({ peer: utils.getPeerId(peer), ...options });
    },
  };
  installListener(
    client,
    { chatId: '-100123', trigger: 'ping', reply: 'pong' },
    '9007199254740993',
  );
  return { client, callbacks, sent, handler, builder };
}

function message({ channel = true, outgoing = false, old = false } = {}) {
  const peer = channel
    ? new Api.PeerChannel({ channelId: 123n })
    : new Api.PeerChat({ chatId: 123n });
  const parent = new Api.Message({
    id: 12,
    peerId: peer,
    fromId: new Api.PeerUser({ userId: 9007199254740993n }),
    date: 1,
    message: 'hello',
    out: true,
  });
  const incoming = new Api.Message({
    id: 42,
    peerId: peer,
    fromId: new Api.PeerUser({ userId: 456n }),
    date: Math.floor(Date.now() / 1000) - (old ? 10 : 0),
    message: 'ping',
    out: outgoing,
    replyTo: new Api.MessageReplyHeader({ replyToMsgId: 12 }),
  });
  incoming.getReplyMessage = async () => parent;
  return incoming;
}

test('real library event builder resolves the group ID and sends a threaded response', async () => {
  const f = fixture();
  assert.ok(f.builder instanceof NewMessage);
  await f.builder.resolve(f.client);
  assert.deepEqual(f.builder.chats, ['-100123']);
  const event = f.builder.build(
    new Api.UpdateNewChannelMessage({
      message: message(),
      pts: 1,
      ptsCount: 1,
    }),
  );
  assert.ok(await f.builder.filter(event));
  await f.handler(event);
  assert.deepEqual(f.sent, [
    { peer: '-100123', message: 'pong', replyTo: 42, parseMode: false },
  ]);
});

test('real event filter rejects outgoing messages and other groups; edits are not new events', async () => {
  const f = fixture();
  await f.builder.resolve(f.client);
  for (const incoming of [
    message({ outgoing: true }),
    message({ channel: false }),
  ]) {
    const event = f.builder.build(
      new Api.UpdateNewMessage({ message: incoming, pts: 1, ptsCount: 1 }),
    );
    assert.ok(!(await f.builder.filter(event)));
  }
  assert.equal(
    f.builder.build(
      new Api.UpdateEditChannelMessage({
        message: message(),
        pts: 1,
        ptsCount: 1,
      }),
    ),
    undefined,
  );
});

test('disconnect lifecycle suppresses replies and reconnect resumes without old events', async () => {
  const f = fixture();
  const event = { message: message() };
  f.callbacks.disconnect();
  await f.handler(event);
  f.callbacks.reconnect();
  await f.handler({ message: message({ old: true }) });
  assert.equal(f.sent.length, 0);
  await f.handler(event);
  assert.equal(f.sent.length, 1);
});

test('client rejects malformed sessions without attempting a network connection', () => {
  assert.throws(
    () =>
      createClient({ apiId: 123, apiHash: 'a'.repeat(32), session: 'invalid' }),
    /Invalid TELEGRAM_SESSION/,
  );
});

test('authorization check requires a valid session', async () => {
  let connected = false;
  await assert.rejects(
    connectAuthorized({
      async connect() {
        connected = true;
      },
      async checkAuthorization() {
        return false;
      },
    }),
    /npm run login/,
  );
  assert.equal(connected, true);
});
