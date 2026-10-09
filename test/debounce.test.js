const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createDebouncer } = require('../src/debounce');
const { MAX_DELAY_MS } = require('../src/duration');
const { createFakeTimers } = require('./support/fake-timers.cjs');

function fixture(minMs = 1000, maxMs = 3000, options = {}) {
  const timers = createFakeTimers();
  const fired = [];
  const errors = [];
  const scheduler = createDebouncer({
    minMs,
    maxMs,
    ...timers.options,
    onFire: async (message) => fired.push(message.id),
    onError: () => errors.push('sanitized failure'),
    ...options,
  });
  return { timers, fired, errors, scheduler };
}

test('chooses both inclusive delay bounds and never fires early', async () => {
  for (const choose of [
    (min) => min,
    (_min, exclusiveMax) => exclusiveMax - 1,
  ]) {
    const f = fixture(1000, 3000, {
      random: (min, max) => {
        assert.equal(min, 1000);
        assert.equal(max, 3001);
        return choose(min, max);
      },
    });
    f.scheduler.schedule({ id: 1 });
    const delay = f.timers.nextDelay;
    assert.ok(delay === 1000 || delay === 3000);
    await f.timers.advance(delay - 1);
    assert.deepEqual(f.fired, []);
    await f.timers.advance(1);
    assert.deepEqual(f.fired, [1]);
  }
});

test('replaces the pending ping and samples a new delay for each eligible message', async () => {
  let draws = 0;
  const f = fixture(1000, 3000, { random: () => [1000, 3000][draws++] });
  f.scheduler.schedule({ id: 1 });
  await f.timers.advance(500);
  f.scheduler.schedule({ id: 2 });
  assert.equal(f.timers.pending, 1);
  await f.timers.advance(2999);
  assert.deepEqual(f.fired, []);
  await f.timers.advance(1);
  assert.deepEqual(f.fired, [2]);
  assert.equal(draws, 2);
});

test('ignores duplicates and older messages, including after a timer has fired', async () => {
  const f = fixture();
  f.scheduler.schedule({ id: 2 });
  await f.timers.advance(500);
  f.scheduler.schedule({ id: 2 });
  f.scheduler.schedule({ id: 1 });
  assert.equal(f.timers.nextDelay, 500);
  await f.timers.advance(500);
  f.scheduler.schedule({ id: 1 });
  assert.equal(f.timers.pending, 0);
  assert.deepEqual(f.fired, [2]);
});

test('supports fixed, zero, hours-long, and maximum-native delays without real waiting', async () => {
  for (const delay of [0, 1000, 4 * 3600000, MAX_DELAY_MS]) {
    const f = fixture(delay, delay);
    f.scheduler.schedule({ id: 1 });
    assert.equal(f.timers.nextDelay, delay);
    await f.timers.advance(delay);
    assert.deepEqual(f.fired, [1]);
  }
});

test('cancellation clears the timer and invalidates already-running work', async () => {
  let current;
  const f = fixture(0, 0, {
    onFire: async (_message, isCurrent) => {
      current = isCurrent;
    },
  });
  f.scheduler.schedule({ id: 1 });
  await f.timers.advance(0);
  assert.equal(current(), true);
  const epoch = f.scheduler.epoch;
  f.scheduler.cancel();
  assert.equal(current(), false);
  assert.equal(f.scheduler.epoch, epoch + 1);
  f.scheduler.schedule({ id: 2 });
  f.scheduler.cancel();
  await f.timers.advance(MAX_DELAY_MS);
  assert.equal(f.timers.pending, 0);
});

test('replacement invalidates a firing callback and contains async errors', async () => {
  let current;
  const f = fixture(0, 0, {
    onFire: async (_message, isCurrent) => {
      current = isCurrent;
      throw new Error('private data');
    },
  });
  f.scheduler.schedule({ id: 1 });
  await f.timers.advance(0);
  assert.equal(f.errors.length, 1);
  f.scheduler.schedule({ id: 2 });
  assert.equal(current(), false);
  await f.timers.advance(0);
  assert.equal(f.errors.length, 2);
});
