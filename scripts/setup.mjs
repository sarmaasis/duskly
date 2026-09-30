#!/usr/bin/env node
import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const apiDir = join(root, 'apps/api');

function run(command, args, { cwd = root, input = '', quiet = false } = {}) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', input });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error((result.stderr || result.stdout || `${command} failed`).trim());
  if (!quiet && result.stdout) process.stdout.write(result.stdout);
  return result.stdout.trim();
}

function wrangler(args, options = {}) {
  return run('pnpm', ['exec', 'wrangler', ...args], { cwd: apiDir, ...options });
}

function valueFromJson(text, pattern, label) {
  const match = text.match(pattern);
  if (!match) throw new Error(`Could not read ${label} from Wrangler's response.`);
  return match[0];
}

async function ask(question, fallback = '') {
  const answer = (await prompt.question(question)).trim();
  return answer || fallback;
}

function origin(value, label) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash) throw new Error(`${label} must be an HTTPS origin without a path.`);
  return url.origin;
}

const prompt = createInterface({ input: process.stdin, output: process.stdout });

async function main() {
  if (existsSync(join(root, '.env.deploy'))) throw new Error('.env.deploy already exists. This setup creates a new instance; use pnpm deploy:release to update an existing one.');

  console.log('Duskly setup creates a new Cloudflare instance. You need two subdomains already managed by Cloudflare and a verified Email Service sender.');
  let loggedIn = true;
  try {
    wrangler(['whoami'], { quiet: true });
  } catch {
    loggedIn = false;
  }
  if (!loggedIn) wrangler(['login']);

  const suggestedInstance = `duskly-${randomBytes(3).toString('hex')}`;
  const instance = await ask(`Instance name [${suggestedInstance}]: `, suggestedInstance);
  if (!/^[a-z][a-z0-9-]{1,62}[a-z0-9]$/.test(instance)) throw new Error('Instance name must use lowercase letters, numbers, and hyphens.');
  const webOrigin = origin(await ask('Web URL (for example https://social.example.com): '), 'Web URL');
  const apiOrigin = origin(await ask('API URL (for example https://api.example.com): '), 'API URL');
  if (webOrigin === apiOrigin) throw new Error('Web URL and API URL must be different.');
  const emailFrom = await ask('Verified Email Service sender (for example Duskly <noreply@example.com>): ');
  if (!emailFrom) throw new Error('A verified email sender is required.');

  const r2Bucket = `${instance}-media`;
  console.log(`\nCreating Cloudflare resources for ${instance}…`);
  const d1 = wrangler(['d1', 'create', instance, '--json'], { quiet: true });
  const kv = wrangler(['kv', 'namespace', 'create', 'KV', '--json'], { quiet: true });
  const d1Id = valueFromJson(d1, /[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}/i, 'the D1 database ID');
  const kvId = valueFromJson(kv, /\b[\da-f]{32}\b/i, 'the KV namespace ID');
  wrangler(['r2', 'bucket', 'create', r2Bucket]);
  wrangler(['queues', 'create', `${instance}-publish`]);
  wrangler(['queues', 'create', `${instance}-publish-dlq`]);

  writeFileSync(join(root, '.env.deploy'), [
    `D1_DATABASE_ID=${d1Id}`,
    `KV_NAMESPACE_ID=${kvId}`,
    `DUSKLY_INSTANCE=${instance}`,
    `R2_BUCKET_NAME=${r2Bucket}`,
    `WEB_ORIGIN=${webOrigin}`,
    `API_ORIGIN=${apiOrigin}`,
    `EMAIL_FROM=${emailFrom}`,
    'DUSKLY_MODE=selfhost',
    '',
  ].join('\n'));

  run(process.execPath, ['scripts/deploy.mjs', 'configure']);
  const authSecret = `${randomBytes(32).toString('hex')}\n`;
  const tokenKey = `${randomBytes(32).toString('hex')}\n`;
  wrangler(['secret', 'put', 'BETTER_AUTH_SECRET', '--config', 'wrangler.deploy.json'], { input: authSecret });
  wrangler(['secret', 'put', 'TOKEN_ENCRYPTION_KEY', '--config', 'wrangler.deploy.json'], { input: tokenKey });
  run(process.execPath, ['scripts/deploy.mjs', 'release']);

  console.log(`\nDuskly is deployed. Open ${webOrigin}, request an email code, then connect an account and send a test post.`);
}

main().catch((error) => {
  console.error(`\nSetup stopped: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
}).finally(() => prompt.close());
