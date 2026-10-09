const { utils } = require('teleproto');
const { NewMessage } = require('teleproto/events');
const { createHandler } = require('./handler');
const { createLiveWindow } = require('./live-window');

function installListener(client, config, selfId) {
  const live = createLiveWindow();
  client.onDisconnect(() => live.pause());
  client.onReconnecting(() => live.pause());
  client.onReconnect(() => live.resume());
  const handler = createHandler({
    client,
    config,
    selfId,
    chatIdOf: (message) => utils.getPeerId(message.peerId),
    isLive: (message) => live.allows(message),
  });
  // Event builders normalize chat arguments to strings; pass the marked ID,
  // rather than an entity's JSON string representation.
  client.addEventHandler(
    handler,
    new NewMessage({ incoming: true, chats: [config.chatId] }),
  );
  live.resume();
}

module.exports = { installListener };
