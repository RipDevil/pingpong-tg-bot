# Repository Guidelines

## Project Structure & Module Organization

This Node.js Telegram user-account client uses `teleproto`, the maintained GramJS fork. `src/` contains configuration, duration parsing, authentication, group discovery, listener setup, debounce scheduling, reply rules, and session persistence. `test/` contains automated tests and fake timer support. `README.md` documents operation; `.env.example` lists configuration. No assets or build output are required.

## Build, Test, and Development Commands

Use Node.js 22 or newer.

- `npm ci`: install locked dependencies.
- `npm run login`: authorize interactively and save the session in local `.env`.
- `npm run chats`: list available group IDs.
- `npm start`: listen using saved credentials.
- `npm test`: run Node's built-in test runner without Telegram access.
- `npm run format` / `npm run format:check`: apply or verify Prettier formatting.

There is no compilation step, database, or container deployment.

## Coding Style & Naming Conventions

Use CommonJS JavaScript, two-space indentation, single quotes, and semicolons; Prettier is authoritative. Use descriptive camelCase identifiers and lowercase, hyphen-separated module filenames. Keep Telegram identifiers as strings or library objects, not JavaScript numbers. Isolate network calls from testable reply rules.

## Testing Guidelines

Name tests `test/*.test.js`. Mock network operations and use temporary directories for persistence tests. Inject randomness and fake timers for delay tests; never wait hours or use flaky statistical assertions. Cover burst replacement, out-of-order validation, fresh-message checks, cancellation, configuration bounds, and existing reply rules. Add regression tests for fixes. No numerical coverage threshold is configured. Record live account testing separately from automated checks.

## Behavior & Configuration

Authenticate as a user, not a Bot API account. Handle one group and direct replies to any personally authored message. Match the entire trimmed trigger ignoring case; send literal response text. Maintain one group-wide debounce timer: each eligible ping replaces the pending reply, and only the latest ping receives a response. Nonqualifying messages and duplicates do not reset it. Do not send typing-status updates.

`REPLY_DELAY_MIN` and `REPLY_DELAY_MAX` accept nonnegative integer `ms`, `s`, `m`, or `h` durations, defaulting to `1s` and `3s`. Validate ordered bounds and the native timer limit of `2147483647ms`. Re-fetch and validate messages before sending. Cancel timers and invalidate asynchronous work on disconnect, reconnect initiation, or shutdown; restart discards pending work. Ignore outgoing and edited-message updates and historical messages. Use one process per account/group; scheduling and bounded deduplication stay in memory.

## Commit & Pull Request Guidelines

History contains only `Initial commit`; use focused commits with imperative subjects such as `Add reply handling`. Describe behavior changes, linked issues, validation, and checks that could not run. Update README and this guide when commands, dependencies, structure, or behavior change.

## Security & Configuration

Never commit or log sessions, passwords, login codes, or real API credentials. Keep local `.env` ignored and examples populated only with placeholders. Preserve other settings when saving sessions. Report sanitized errors; invalid authorization requires interactive login. No historical replay or complex deployment infrastructure is intended.
