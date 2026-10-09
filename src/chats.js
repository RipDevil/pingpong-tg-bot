const { utils } = require('teleproto');
const { loadConfig } = require('./config');
const {
  createClient,
  connectAuthorized,
  installShutdown,
} = require('./client');
const { reportError } = require('./errors');

async function main() {
  const client = createClient(loadConfig('chats'));
  installShutdown(client);
  try {
    await connectAuthorized(client);
    console.log('Group ID\tGroup title');
    for await (const dialog of client.iterDialogs({})) {
      if (dialog.isGroup) {
        console.log(`${utils.getPeerId(dialog.entity)}\t${dialog.title}`);
      }
    }
  } finally {
    await client.destroy();
  }
}

main().catch((error) => {
  reportError(
    error,
    'Unable to list groups. Check API credentials, connection, and session; run npm run login if needed.',
  );
});
