import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deploymentConfig } from './deploy.mjs';
const api = JSON.parse(readFileSync(new URL('../apps/api/wrangler.jsonc', import.meta.url)));
const web = JSON.parse(readFileSync(new URL('../apps/web/wrangler.jsonc', import.meta.url)));
const env = { D1_DATABASE_ID: '11111111-1111-1111-1111-111111111111', KV_NAMESPACE_ID: 'a'.repeat(32), WEB_ORIGIN: 'https://social.example.com/', API_ORIGIN: 'https://api.example.com', EMAIL_FROM: 'Duskly <noreply@example.com>' };
test('deployment config wires both workers without mutating templates or copying secrets', () => {
  const config = deploymentConfig({ ...env, BETTER_AUTH_SECRET: 'never-copy' }, api, web);
  assert.equal(config.api.vars.BETTER_AUTH_URL, config.web.vars.API_ORIGIN);
  assert.equal(config.api.vars.WEB_ORIGIN, config.web.vars.WEB_ORIGIN);
  assert.equal(config.api.vars.DUSKLY_MODE, 'selfhost');
  assert.equal(config.web.vars.DUSKLY_MODE, 'selfhost');
  assert.equal(config.api.vars.CLOUD_TESTER_EMAILS, undefined);
  assert.equal(config.api.d1_databases[0].database_id, env.D1_DATABASE_ID);
  assert.equal(api.d1_databases[0].database_id, '${D1_DATABASE_ID}');
  assert.ok(!JSON.stringify(config).includes('never-copy'));
  const cloud = deploymentConfig({ ...env, DUSKLY_MODE: 'cloud', CLOUD_TESTER_EMAILS: 'a@b.co, c@d.co' }, api, web);
  assert.equal(cloud.api.vars.DUSKLY_MODE, 'cloud');
  assert.equal(cloud.web.vars.DUSKLY_MODE, 'cloud');
  assert.equal(cloud.api.vars.CLOUD_TESTER_EMAILS, 'a@b.co, c@d.co');
});
test('deployment fails before writing or uploading with missing or invalid settings', () => {
  for (const key of Object.keys(env)) assert.throws(() => deploymentConfig({ ...env, [key]: '' }, api, web), /Missing deployment/);
  for (const origin of ['http://api.example.com', 'https://example.com/path', 'https://user:pass@example.com', 'https://example.com?token=secret', 'https://localhost']) {
    assert.throws(() => deploymentConfig({ ...env, API_ORIGIN: origin }, api, web));
  }
  assert.throws(() => deploymentConfig({ ...env, D1_DATABASE_ID: 'placeholder' }, api, web), /UUID/);
  assert.throws(() => deploymentConfig({ ...env, KV_NAMESPACE_ID: 'placeholder' }, api, web), /namespace ID/);
  assert.throws(() => deploymentConfig({ ...env, DUSKLY_MODE: 'typo' }, api, web), /DUSKLY_MODE/);
  assert.throws(() => deploymentConfig({ ...env, API_ORIGIN: env.WEB_ORIGIN }, api, web), /separate Workers/);
});
