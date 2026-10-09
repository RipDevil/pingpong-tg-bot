# Telegram Ping/Pong

A small Node.js client that replies as your existing Telegram user account in one group. When someone replies `ping` to any message you authored, your account replies `pong` to their trigger message.

Uses Telegram's MTProto user API through [teleproto](https://www.npmjs.com/package/teleproto), the maintained GramJS fork. You do not need a BotFather token.

## Setup

Install Node.js 22 or newer, then install dependencies:

```sh
npm ci
```

Copy `.env.example` to `.env` if the local file does not already exist. A placeholder `.env` is supplied when setting up this workspace; Git excludes it.

```sh
# Run only if you don't already have a .env:
cp .env.example .env
```

1. Visit [Telegram API development tools](https://my.telegram.org/apps), create an application, and enter its API ID and API hash in `.env`.
2. Run `npm run login`. Enter your phone number with country code and the login code Telegram sends to your existing app or phone. Enter your two-factor password or email verification details if requested. Terminal input is visible; use a private terminal.
3. The login command saves `TELEGRAM_SESSION` in `.env` while preserving the other settings. It does not save login codes or passwords, or print the session.
4. Run `npm run chats`, then copy the desired group ID into `TELEGRAM_CHAT_ID`. Your account must already belong to the group and have permission to send messages.
5. Run `npm start`. Press Ctrl+C to stop.

Subsequent starts reuse the session without asking for login details. If the session expires or is revoked, run `npm run login` again. Create the session while other clients for this project are stopped; copy the configured `.env` privately to a server if needed.

## Configuration

All commands read the repository's `.env`, even when launched from another directory. Existing process environment variables take precedence.

| Variable            | Purpose                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------- |
| `TELEGRAM_API_ID`   | Positive application API ID from Telegram.                                                        |
| `TELEGRAM_API_HASH` | Application API hash from Telegram.                                                               |
| `TELEGRAM_SESSION`  | Saved account authorization; written by `npm run login`.                                          |
| `TELEGRAM_CHAT_ID`  | Negative group ID printed by `npm run chats`; keep the full value, including `-100` when present. |
| `TRIGGER_MESSAGE`   | Whole-message trigger; defaults to `ping`.                                                        |
| `REPLY_MESSAGE`     | Plain-text response; defaults to `pong`.                                                          |

For example, change the last two settings to:

```dotenv
TRIGGER_MESSAGE="knock knock"
REPLY_MESSAGE="Who's there?"
```

Restart after changing configuration. Quote values containing spaces or `#`; dotenv also supports quoted multiline values. Empty trigger/response values are rejected, and the response is limited to 4096 characters.

## Reply Behavior

- The whole trigger is matched without case sensitivity, after trimming surrounding whitespace: `PING` works, `ping please` does not.
- Only direct replies to messages sent by your personal account in the configured group qualify. Replies to other people or messages you sent as a channel do not.
- The response replies to the incoming trigger, not to your earlier message. Response text is sent literally, without Markdown parsing.
- Your own outgoing messages, edited messages, other chats, unavailable referenced messages, and historical messages are ignored.
- Only live messages are handled. During reconnection, replies are paused; messages from the offline interval are ignored when listening resumes. Telegram timestamps have one-second precision, so the boundary second cannot distinguish old and new messages exactly.
- The most recent 1000 processed trigger IDs are deduplicated in memory. Run only one instance for a given account/group; there is no cross-process coordination.
- The library reconnects automatically and waits out flood limits up to 60 seconds. Longer waits or other failed requests are reported without stopping the listener; failed triggers are not explicitly retried by this application.

## Running on a PC or Server

Run `npm start` in a terminal, or keep it in a `tmux`/`screen` session on a server. The process must stay running, the machine must stay awake, and Telegram must be reachable. For automatic restart, use your operating system's service manager with Node.js and this repository as its working directory. No containers, compilation, database, or web server are needed.

Ctrl+C or SIGTERM releases the client connection. Startup configuration and authorization failures exit with a nonzero status.

## Development and Testing

```sh
npm test          # Node test runner; Telegram calls are mocked
npm run format    # Format JavaScript, JSON, and Markdown
npm run format:check
```

Source modules live in `src/` and `*.test.js` tests in `test/`. Tests cover reply rules, real-library event filtering, reconnect boundaries, errors, configuration, and session persistence. They do not need a Telegram account or network connection.

For a live smoke test, use a friends' test group: send any message from your account, ask a friend to reply `ping`, and confirm a threaded `pong` from your account. Verify non-replies and replies to others produce no response; then restart the app and repeat without logging in again.

## Credentials

Keep `.env` private: the session grants access to your Telegram account. Git ignores `.env`, related temporary files, and logs. Only `.env.example` contains committed placeholders. Session saves use an atomic replacement and owner-only permissions on systems supporting Unix permissions. If a session is exposed, terminate it through Telegram's **Settings → Devices** and log in again.
