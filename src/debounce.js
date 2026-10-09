const { randomInt } = require('node:crypto');

function createDebouncer({
  minMs,
  maxMs,
  onFire,
  onError,
  random = randomInt,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
}) {
  let timer;
  let generation = 0;
  let epoch = 0;
  let newestId = -1;

  return {
    get epoch() {
      return epoch;
    },
    schedule(message) {
      // A slower lookup for an older ping must not replace a newer reply.
      if (message.id <= newestId) return;
      newestId = message.id;
      clearTimer(timer);
      const token = ++generation;
      const delay = random(minMs, maxMs + 1);
      timer = setTimer(async () => {
        if (token !== generation) return;
        timer = undefined;
        try {
          await onFire(message, () => token === generation);
        } catch {
          onError();
        }
      }, delay);
    },
    cancel() {
      clearTimer(timer);
      timer = undefined;
      generation += 1;
      // Invalidate validation started before a disconnect, even if the
      // connection comes back within the same Telegram timestamp second.
      epoch += 1;
    },
  };
}

module.exports = { createDebouncer };
