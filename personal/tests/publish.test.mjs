import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';

function fixture(t, failUpload = false) {
  const directory = mkdtempSync(path.join(tmpdir(), 'readest-publish-test-'));
  const version = '0.12.16-personal.1';
  const prefix = 'Readest-Personal_' + version + '_';
  writeFileSync(path.join(directory, 'build.json'), JSON.stringify({
    version, repository: 'SavingBigHead/readest', upstream_tag: 'v0.12.16',
    upstream_sha: '0'.repeat(40), controller_sha: '1'.repeat(40),
    release_tag: 'personal-v0.12.16-r1',
  }));
  for (const file of ['windows-x64.exe', 'linux-x64.AppImage', 'android-arm64.apk']) {
    writeFileSync(path.join(directory, prefix + file), 'test installer');
    writeFileSync(path.join(directory, prefix + file + '.sig'), 'test-signature');
  }
  writeFileSync(path.join(directory, prefix + 'source.tar.gz'), 'test source archive');
  writeFileSync(path.join(directory, 'release-notes.json'), '{"releases":{}}');
  const previous = {
    fetch: globalThis.fetch, log: console.log, argv: process.argv[2],
    repo: process.env.GITHUB_REPOSITORY, token: process.env.GH_TOKEN,
  };
  process.argv[2] = directory;
  process.env.GITHUB_REPOSITORY = 'SavingBigHead/readest';
  process.env.GH_TOKEN = 'unit-test-not-a-token';
  const requests = [];
  console.log = () => {}; // Silence the simulated publisher, which makes no network requests.
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url, ...options });
    if (url.startsWith('https://uploads.github.com/')) {
      return new Response('{}', { status: failUpload ? 500 : 201 });
    }
    if (url.includes('/releases/tags/')) return new Response('{}', { status: 404 });
    if (options.method === 'POST') {
      return Response.json({
        id: 1, draft: true,
        upload_url: 'https://uploads.github.com/repos/SavingBigHead/readest/releases/1/assets{?name,label}',
      }, { status: 201 });
    }
    if (url.endsWith('/assets?per_page=100')) return Response.json([]);
    return Response.json({});
  };
  t.after(() => {
    globalThis.fetch = previous.fetch;
    console.log = previous.log;
    process.argv[2] = previous.argv;
    for (const [name, value] of [
      ['GITHUB_REPOSITORY', previous.repo], ['GH_TOKEN', previous.token],
    ]) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    rmSync(directory, { recursive: true, force: true });
  });
  return { directory, requests };
}

test('release stays draft until every installer, signature and source asset is uploaded', async (t) => {
  const { directory, requests } = fixture(t);
  await import('../publish.mjs?test=' + randomUUID());
  const created = requests.find((request) => request.method === 'POST' && !request.url.startsWith('https://uploads.'));
  assert.equal(JSON.parse(created.body).draft, true);
  const final = requests.at(-1);
  assert.equal(final.method, 'PATCH');
  assert.equal(JSON.parse(final.body).draft, false);
  const manifest = JSON.parse(readFileSync(path.join(directory, 'latest.json'), 'utf8'));
  assert.equal(manifest.version, '0.12.16-personal.1');
  for (const platform of ['windows-x86_64', 'linux-x86_64', 'android-arm64']) {
    assert.equal(manifest.platforms[platform].signature, 'test-signature');
    assert.ok(manifest.platforms[platform].url.startsWith('https://github.com/SavingBigHead/readest/releases/download/personal-v0.12.16-r1/'));
  }
  assert.ok(readFileSync(path.join(directory, 'SHA256SUMS'), 'utf8').includes('source.tar.gz'));
});

test('an asset upload failure never publishes the incomplete release', async (t) => {
  const { requests } = fixture(t, true);
  await assert.rejects(import('../publish.mjs?test=' + randomUUID()), /Asset upload failed/);
  assert.equal(requests.some((request) => request.method === 'PATCH'), false);
});
