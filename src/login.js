const readline = require('node:readline/promises');
const { loadConfig, envPath } = require('./config');
const { createClient, installShutdown } = require('./client');
const { saveSession } = require('./session');
const { UserError, reportError } = require('./errors');

async function main() {
  const client = createClient(loadConfig('login'));
  installShutdown(client);
  const prompts = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    console.log(
      'Log in locally. Input is visible in this terminal; do not share it.',
    );
    await client.start({
      phoneNumber: () => prompts.question('Phone number (with country code): '),
      phoneCode: () => prompts.question('Telegram login code: '),
      password: () => prompts.question('Two-factor authentication password: '),
      emailAddress: () => prompts.question('Telegram login email: '),
      emailVerification: async () => ({
        type: 'code',
        code: await prompts.question('Email verification code: '),
      }),
      onError: () => {
        // Do not print the raw error, which may contain credentials.
        throw new UserError(
          'Login failed. Check your details and run npm run login again.',
        );
      },
    });
    await saveSession(envPath, client.session.save());
    console.log(
      'Session saved in .env. Run npm run chats to find your group ID.',
    );
  } finally {
    prompts.close();
    await client.destroy();
  }
}

main().catch((error) => {
  reportError(
    error,
    'Unable to complete login. Check .env, login details, connection, and file permissions.',
  );
});
