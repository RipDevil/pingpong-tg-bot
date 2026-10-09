function createHandler({
  client,
  config,
  selfId,
  chatIdOf,
  isLive,
  log = console.error,
}) {
  const seen = new Set();
  return async (event) => {
    const message = event.message;
    if (!message || message.out || chatIdOf(message) !== config.chatId) return;
    if (!isLive(message)) return;
    if (message.message?.trim().toLowerCase() !== config.trigger.toLowerCase())
      return;
    const replyId = message.replyTo?.replyToMsgId;
    if (!replyId || seen.has(message.id)) return;
    seen.add(message.id);
    if (seen.size > 1000) seen.delete(seen.values().next().value);
    try {
      const parent = await message.getReplyMessage();
      if (!parent || parent.senderId?.toString() !== selfId) return;
      if (chatIdOf(parent) !== config.chatId || !isLive(message)) return;
      await client.sendMessage(message.peerId, {
        message: config.reply,
        replyTo: message.id,
        parseMode: false,
      });
    } catch {
      log(
        'Unable to process a trigger; check group access and Telegram connectivity.',
      );
    }
  };
}

module.exports = { createHandler };
