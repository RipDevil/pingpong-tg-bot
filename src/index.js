const { Api, utils } = require('teleproto');
const { loadConfig } = require('./config');
const {
  createClient,
  connectAuthorized,
  installShutdown,
} = require('./client');
const { installListener } = require('./listener');
const { UserError, reportError } = require('./errors');

async function main() {
  const config = loadConfig('start');
  const client = createClient(config);
  installShutdown(client);
  try {
    await connectAuthorized(client);
    const self = await client.getMe();
    // Populate the peer cache, including access hashes for supergroups.
    let group;
    for await (const dialog of client.iterDialogs({})) {
      if (dialog.isGroup && utils.getPeerId(dialog.entity) === config.chatId) {
        group = dialog.entity;
        break;
      }
    }
    if (
      !group ||
      (group instanceof Api.Channel && !group.megagroup && !group.gigagroup)
    ) {
      throw new UserError(
        'Configured group is unavailable. Check membership and run npm run chats.',
      );
    }
    installListener(client, config, self.id.toString());
    console.log('Listening in the configured group. Press Ctrl+C to stop.');
  } catch (error) {
    await client.destroy();
    throw error;
  }
}

main().catch((error) => {
  reportError(
    error,
    'Startup failed. Check .env, Telegram connectivity, and session; run npm run login if needed.',
  );
});
