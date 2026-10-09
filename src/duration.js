const { UserError } = require('./errors');

const MAX_DELAY_MS = 2147483647;
const units = { ms: 1, s: 1000, m: 60000, h: 3600000 };

function parseDuration(value, name) {
  const match = /^(\d+)(ms|s|m|h)$/.exec(value.trim());
  const milliseconds = match ? Number(match[1]) * units[match[2]] : NaN;
  if (!Number.isSafeInteger(milliseconds) || milliseconds > MAX_DELAY_MS) {
    throw new UserError(
      `${name} must be a nonnegative integer duration with ms, s, m, or h (maximum ${MAX_DELAY_MS}ms).`,
    );
  }
  return milliseconds;
}

module.exports = { MAX_DELAY_MS, parseDuration };
