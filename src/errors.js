class UserError extends Error {}

function reportError(error, fallback) {
  console.error(error instanceof UserError ? error.message : fallback);
  process.exitCode = 1;
}

module.exports = { UserError, reportError };
