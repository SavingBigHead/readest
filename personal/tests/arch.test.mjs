import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { archPackageName, archVersion } from '../prepare-arch.mjs';

test('personal versions map to ordered, valid pacman package filenames', () => {
  assert.equal(archVersion('0.12.16-personal.2'), '0.12.16.personal.2');
  assert.equal(archPackageName('0.12.16-personal.2'), 'readest-personal-bin-0.12.16.personal.2-1-x86_64.pkg.tar.zst');
  for (const version of ['0.12.16', '0.12.16-personal.0', '0.12.16-personal.2\npayload', '1;exit 1']) {
    assert.throws(() => archVersion(version), /Expected a personal release/);
  }
});

test('the generated Arch recipe pins the exact deb and includes its license', (t) => {
  const directory = mkdtempSync(path.join(tmpdir(), 'readest-arch-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const root = path.join(directory, 'source');
  const dist = path.join(directory, 'dist');
  const destination = path.join(directory, 'arch');
  mkdirSync(path.join(root, 'personal'), { recursive: true });
  mkdirSync(dist);
  writeFileSync(path.join(root, 'personal/build.json'), JSON.stringify({ version: '0.12.16-personal.2' }));
  writeFileSync(path.join(root, 'LICENSE'), 'test license');
  const payload = Buffer.from('exact Linux build payload');
  writeFileSync(path.join(dist, 'Readest-Personal_0.12.16-personal.2_linux-x64.deb'), payload);
  const result = spawnSync(process.execPath, [
    fileURLToPath(new URL('../prepare-arch.mjs', import.meta.url)), root, dist, destination,
  ], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(readFileSync(path.join(destination, 'readest-personal.deb')), payload);
  assert.equal(readFileSync(path.join(destination, 'LICENSE'), 'utf8'), 'test license');
  const recipe = readFileSync(path.join(destination, 'PKGBUILD'), 'utf8');
  assert.match(recipe, /^pkgver=0\.12\.16\.personal\.2$/m);
  assert.ok(recipe.includes(createHash('sha256').update(payload).digest('hex')));
  assert.ok(recipe.includes(createHash('sha256').update('test license').digest('hex')));
  assert.doesNotMatch(recipe, /@(PKGVER|DEB_SHA256|LICENSE_SHA256)@/);
});
