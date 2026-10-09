function createLiveWindow(now = () => Date.now()) {
  let active = false;
  let since = Infinity;
  return {
    pause() {
      active = false;
    },
    resume() {
      since = Math.floor(now() / 1000);
      active = true;
    },
    allows(message) {
      return active && Number.isInteger(message.date) && message.date >= since;
    },
  };
}

module.exports = { createLiveWindow };
