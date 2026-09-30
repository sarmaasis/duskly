#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));

export function deploymentConfig(env, api, web) {
  const required = ['D1_DATABASE_ID', 'KV_NAMESPACE_ID', 'API_ORIGIN', 'WEB_ORIGIN', 'EMAIL_FROM'];
  const missing = required.filter((key) => !env[key]?.trim());
  if (missing.length) throw new Error(`Missing deployment configuration: ${missing.join(', ')}. Copy .env.deploy.example to .env.deploy and fill it in.`);
  if (!/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(env.D1_DATABASE_ID)) throw new Error('D1_DATABASE_ID must be a database UUID.');
  if (!/^[\da-f]{32}$/i.test(env.KV_NAMESPACE_ID)) throw new Error('KV_NAMESPACE_ID must be a 32-character namespace ID.');
  for (const key of ['API_ORIGIN', 'WEB_ORIGIN']) {
    const url = new URL(env[key]);
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash || url.hostname === 'localhost') {
      throw new Error(`${key} must be a public HTTPS origin without a path, query, or credentials.`);
    }
  }
  if (env.API_ORIGIN.replace(/\/$/, '') === env.WEB_ORIGIN.replace(/\/$/, '')) throw new Error('API_ORIGIN and WEB_ORIGIN must point to separate Workers.');
  const mode = env.DUSKLY_MODE || 'selfhost';
  if (!['selfhost', 'cloud'].includes(mode)) throw new Error('DUSKLY_MODE must be selfhost or cloud.');
  const instance = (env.DUSKLY_INSTANCE || 'duskly').trim();
  if (!/^[a-z][a-z0-9-]{1,62}[a-z0-9]$/.test(instance)) throw new Error('DUSKLY_INSTANCE must be a lowercase Cloudflare-safe name.');
  const r2Bucket = (env.R2_BUCKET_NAME || `${instance}-media`).trim();
  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(r2Bucket)) throw new Error('R2_BUCKET_NAME must be a valid bucket name.');
  const result = { api: structuredClone(api), web: structuredClone(web) };
  result.api.name = `${instance}-api`;
  result.web.name = `${instance}-web`;
  result.api.d1_databases[0].database_id = env.D1_DATABASE_ID;
  result.api.d1_databases[0].database_name = instance;
  result.api.kv_namespaces[0].id = env.KV_NAMESPACE_ID;
  result.api.r2_buckets[0].bucket_name = r2Bucket;
  result.api.queues.producers[0].queue = `${instance}-publish`;
  result.api.queues.consumers[0].queue = `${instance}-publish`;
  result.api.queues.consumers[0].dead_letter_queue = `${instance}-publish-dlq`;
  result.api.analytics_engine_datasets[0].dataset = `${instance}_metrics`;
  result.api.vars = { ...api.vars, WEB_ORIGIN: env.WEB_ORIGIN.replace(/\/$/, ''), BETTER_AUTH_URL: env.API_ORIGIN.replace(/\/$/, ''), EMAIL_FROM: env.EMAIL_FROM, DUSKLY_MODE: mode };
  if (mode === 'cloud') result.api.vars.CLOUD_TESTER_EMAILS = (env.CLOUD_TESTER_EMAILS || '').trim();
  result.web.vars = { ...web.vars, WEB_ORIGIN: result.api.vars.WEB_ORIGIN, API_ORIGIN: result.api.vars.BETTER_AUTH_URL, DUSKLY_MODE: mode };
  result.api.routes = [{ pattern: new URL(result.api.vars.BETTER_AUTH_URL).hostname, custom_domain: true }];
  result.web.routes = [{ pattern: new URL(result.web.vars.WEB_ORIGIN).hostname, custom_domain: true }];
  return result;
}

function run(args, cwd = root) {
  const result = spawnSync('pnpm', args, { cwd, stdio: 'inherit', env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`pnpm ${args.join(' ')} failed (${result.status ?? result.signal}).`);
}

function main() {
  const command = process.argv[2] || 'configure';
  if (!['configure', 'api', 'web', 'migrate', 'release', 'dry-run'].includes(command)) throw new Error('Usage: node scripts/deploy.mjs configure|api|web|migrate|release|dry-run');
  const envPath = join(root, '.env.deploy');
  if (existsSync(envPath)) process.loadEnvFile(envPath);
  const apiDir = join(root, 'apps/api');
  const webDir = join(root, 'apps/web');
  const configs = deploymentConfig(process.env,
    JSON.parse(readFileSync(join(apiDir, 'wrangler.jsonc'), 'utf8')),
    JSON.parse(readFileSync(join(webDir, 'wrangler.jsonc'), 'utf8')));
  for (const [name, config] of Object.entries(configs)) {
    writeFileSync(join(root, `apps/${name}/wrangler.deploy.json`), JSON.stringify(config, null, 2) + '\n');
  }
  console.log(`Configured ${configs.api.vars.DUSKLY_MODE}: ${configs.web.vars.WEB_ORIGIN} → ${configs.web.vars.API_ORIGIN}`);
  if (command === 'configure') return;
  const wrangler = (dir, args) => run(['exec', 'wrangler', ...args, '--config', 'wrangler.deploy.json'], dir);
  if (command === 'release') {
    run(['typecheck']);
    run(['test']);
  }
  // Build before migrations or uploads so a compilation failure cannot leave a partial release.
  if (['web', 'release', 'dry-run'].includes(command)) run(['--filter', '@duskly/web', 'build']);
  if (['migrate', 'release'].includes(command)) wrangler(apiDir, ['d1', 'migrations', 'apply', 'duskly', '--remote']);
  if (['api', 'release', 'dry-run'].includes(command)) wrangler(apiDir, ['deploy', ...(command === 'dry-run' ? ['--dry-run'] : [])]);
  if (['web', 'release', 'dry-run'].includes(command)) wrangler(webDir, ['deploy', '--no-bundle', ...(command === 'dry-run' ? ['--dry-run'] : [])]);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
