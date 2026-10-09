const { utils } = require('teleproto');
const { NewMessage } = require('teleproto/events');
const { createHandler } = require('./handler');
const { createLiveWindow } = require('./live-window');

function installListener(client, config, selfId, timers) {
  const live = createLiveWindow();
  const handler = createHandler({
    client,
    config,
    selfId,
    chatIdOf: (message) => utils.getPeerId(message.peerId),
    isLive: (message) => live.allows(message),
    timers,
  });
  const pause = () => {
    live.pause();
    handler.cancelPending();
  };
  let stopped = false;
  const subscriptions = [
    client.onDisconnect(pause),
    client.onReconnecting(pause),
    client.onReconnect(() => {
      if (!stopped) live.resume();
    }),
  ];
  // Event builders normalize chat arguments to strings; pass the marked ID,
  // rather than an entity's JSON string representation.
  const builder = new NewMessage({ incoming: true, chats: [config.chatId] });
  client.addEventHandler(handler, builder);
  live.resume();
  return () => {
    stopped = true;
    pause();
    for (const unsubscribe of subscriptions) unsubscribe();
    client.removeEventHandler(handler, builder);
  };
}

module.exports = { installListener };
