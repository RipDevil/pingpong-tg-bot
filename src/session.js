const fs = require('node:fs/promises');
const { randomUUID } = require('node:crypto');

async function saveSession(file, session) {
  if (!session || /[\r\n]/.test(session))
    throw new Error('Invalid session value.');
  let contents = '';
  try {
    contents = await fs.readFile(file, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const lines = contents.split(/\r?\n/);
  let replaced = false;
  const updated = lines
    .filter((line) => {
      if (!/^\s*(?:export\s+)?TELEGRAM_SESSION\s*=/.test(line)) return true;
      if (replaced) return false;
      replaced = true;
      return true;
    })
    .map((line) =>
      /^\s*(?:export\s+)?TELEGRAM_SESSION\s*=/.test(line)
        ? `TELEGRAM_SESSION=${session}`
        : line,
    );
  if (!replaced) updated.push(`TELEGRAM_SESSION=${session}`);
  const temporary = `${file}.${randomUUID()}.tmp`;
  let created = false;
  try {
    const handle = await fs.open(temporary, 'wx', 0o600);
    created = true;
    try {
      await handle.writeFile(`${updated.join('\n').replace(/\n*$/, '')}\n`);
    } finally {
      await handle.close();
    }
    await fs.rename(temporary, file);
  } finally {
    if (created) await fs.rm(temporary, { force: true });
  }
}

module.exports = { saveSession };
