const { createDebouncer } = require('./debounce');

function createHandler({
  client,
  config,
  selfId,
  chatIdOf,
  isLive,
  log = console.error,
  timers = {},
}) {
  const seen = new Set();
  const reportFailure = () =>
    log(
      'Unable to process a trigger; check group access and Telegram connectivity.',
    );
  const qualifies = (message) =>
    message &&
    !message.out &&
    chatIdOf(message) === config.chatId &&
    isLive(message) &&
    message.replyTo?.replyToMsgId &&
    message.message?.trim().toLowerCase() === config.trigger.toLowerCase();
  const ownParent = async (message) => {
    const parent = await message.getReplyMessage();
    return (
      parent &&
      parent.senderId?.toString() === selfId &&
      chatIdOf(parent) === config.chatId
    );
  };
  const debouncer = createDebouncer({
    minMs: config.replyDelayMinMs ?? 1000,
    maxMs: config.replyDelayMaxMs ?? 3000,
    ...timers,
    onError: reportFailure,
    async onFire(pending, current) {
      // Fetch fresh objects rather than using getReplyMessage's cached parent.
      const [message] = await client.getMessages(pending.peerId, {
        ids: [pending.id],
      });
      if (!current() || !qualifies(message)) return;
      if (!(await ownParent(message)) || !current() || !isLive(message)) return;
      await client.sendMessage(pending.peerId, {
        message: config.reply,
        replyTo: pending.id,
        parseMode: false,
      });
    },
  });

  const handler = async (event) => {
    const message = event.message;
    const epoch = debouncer.epoch;
    try {
      if (!qualifies(message) || seen.has(message.id)) return;
      seen.add(message.id);
      if (seen.size > 1000) seen.delete(seen.values().next().value);
      if (!(await ownParent(message))) return;
      if (epoch !== debouncer.epoch || !isLive(message)) return;
      debouncer.schedule(message);
    } catch {
      reportFailure();
    }
  };
  handler.cancelPending = () => debouncer.cancel();
  return handler;
}

module.exports = { createHandler };
