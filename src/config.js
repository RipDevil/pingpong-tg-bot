const path = require('node:path');
const dotenv = require('dotenv');
const { UserError } = require('./errors');

const envPath = path.resolve(__dirname, '..', '.env');

function readConfig(mode = 'start', env = process.env) {
  const required = (name) => {
    const value = env[name]?.trim();
    if (!value)
      throw new UserError(`Set ${name} in .env before running ${mode}.`);
    return value;
  };
  const apiIdText = required('TELEGRAM_API_ID');
  const apiId = Number(apiIdText);
  if (!/^\d+$/.test(apiIdText) || !Number.isSafeInteger(apiId) || apiId < 1) {
    throw new UserError('TELEGRAM_API_ID must be a positive integer.');
  }
  const apiHash = required('TELEGRAM_API_HASH');
  if (!/^[a-f\d]{32}$/i.test(apiHash)) {
    throw new UserError(
      'TELEGRAM_API_HASH must contain 32 hexadecimal characters.',
    );
  }
  const config = { apiId, apiHash };
  if (mode !== 'login') config.session = required('TELEGRAM_SESSION');
  if (mode === 'start') {
    config.chatId = required('TELEGRAM_CHAT_ID');
    if (!/^-\d+$/.test(config.chatId)) {
      throw new UserError(
        'TELEGRAM_CHAT_ID must be a negative group ID from npm run chats.',
      );
    }
    config.trigger = (env.TRIGGER_MESSAGE ?? 'ping').trim();
    config.reply = env.REPLY_MESSAGE ?? 'pong';
    if (!config.trigger || !config.reply.trim()) {
      throw new UserError(
        'TRIGGER_MESSAGE and REPLY_MESSAGE must not be empty.',
      );
    }
    if (config.reply.length > 4096) {
      throw new UserError('REPLY_MESSAGE must not exceed 4096 characters.');
    }
  }
  return config;
}

function loadConfig(mode) {
  dotenv.config({ path: envPath, quiet: true });
  return readConfig(mode);
}

module.exports = { envPath, readConfig, loadConfig };
