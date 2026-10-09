const { TelegramClient } = require('teleproto');
const { StringSession } = require('teleproto/sessions');
const { Logger } = require('teleproto/extensions');
const { UserError } = require('./errors');

function createClient(config) {
  let session;
  try {
    session = new StringSession(config.session || '');
  } catch {
    throw new UserError('Invalid TELEGRAM_SESSION. Run npm run login again.');
  }
  const client = new TelegramClient(session, config.apiId, config.apiHash, {
    connectionRetries: 5,
    autoReconnect: true,
    floodSleepThreshold: 60,
    baseLogger: new Logger('none'),
  });
  // Avoid library diagnostics containing authentication or message data.
  client.setLogLevel('none');
  client.onError = async () => {
    console.error(
      'Telegram connection error; the client will attempt recovery.',
    );
  };
  return client;
}

async function connectAuthorized(client) {
  await client.connect();
  if (!(await client.checkAuthorization())) {
    throw new UserError(
      'The Telegram session is not authorized. Run npm run login again.',
    );
  }
}

function installShutdown(client) {
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    try {
      await client.destroy();
    } finally {
      process.exit(0);
    }
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

module.exports = { createClient, connectAuthorized, installShutdown };
