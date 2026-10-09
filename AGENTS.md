# Repository Guidelines

## Project Structure & Module Organization

This Node.js Telegram user-account client uses `teleproto`, the maintained GramJS fork. `src/` contains configuration, authentication, group discovery, listener setup, reply rules, and session persistence. `test/` contains automated tests. `README.md` documents operation; `.env.example` lists configuration. No assets or build output are required.

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

Name tests `test/*.test.js`. Mock network operations and use temporary directories for persistence tests. Cover reply rules, author checks, duplicate delivery, connection recovery, configuration errors, and credential handling. Add regression tests for fixes. No numerical coverage threshold is configured. Record live account testing separately from automated checks.

## Behavior & Configuration

Authenticate as a user, not a Bot API account. Handle one group and direct replies to any personally authored message. Match the entire trimmed trigger ignoring case; send literal response text. Ignore outgoing and edited messages and historical updates. Pause during reconnect catch-up. Use one process per account/group; deduplication is bounded and in memory.

## Commit & Pull Request Guidelines

History contains only `Initial commit`; use focused commits with imperative subjects such as `Add reply handling`. Describe behavior changes, linked issues, validation, and checks that could not run. Update README and this guide when commands, dependencies, structure, or behavior change.

## Security & Configuration

Never commit or log sessions, passwords, login codes, or real API credentials. Keep local `.env` ignored and examples populated only with placeholders. Preserve other settings when saving sessions. Report sanitized errors; invalid authorization requires interactive login. No historical replay or complex deployment infrastructure is intended.
