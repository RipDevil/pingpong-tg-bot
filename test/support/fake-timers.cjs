function createFakeTimers() {
  let now = 0;
  let nextId = 0;
  const tasks = new Map();
  return {
    options: {
      random: (minimum) => minimum,
      setTimer(fn, delay) {
        const id = ++nextId;
        tasks.set(id, { at: now + delay, fn });
        return id;
      },
      clearTimer(id) {
        tasks.delete(id);
      },
    },
    get pending() {
      return tasks.size;
    },
    get nextDelay() {
      return tasks.size
        ? Math.min(...[...tasks.values()].map((task) => task.at)) - now
        : undefined;
    },
    async advance(milliseconds) {
      const end = now + milliseconds;
      while (true) {
        const next = [...tasks].sort(
          (a, b) => a[1].at - b[1].at || a[0] - b[0],
        )[0];
        if (!next || next[1].at > end) break;
        tasks.delete(next[0]);
        now = next[1].at;
        await next[1].fn();
      }
      now = end;
    },
  };
}

module.exports = { createFakeTimers };
