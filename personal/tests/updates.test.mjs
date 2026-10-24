import assert from 'node:assert/strict';
import { test } from 'node:test';
import { patchUpdates } from '../patch-updates.mjs';

const original = [
  "const LATEST_DOWNLOAD_BASE_URL = 'https://download.readest.com/releases';",
  'export const READEST_UPDATER_FILE = LATEST_DOWNLOAD_BASE_URL + "/latest.json";',
  'export const READEST_CHANGELOG_FILE = LATEST_DOWNLOAD_BASE_URL + "/release-notes.json";',
  "export const READEST_NIGHTLY_UPDATER_FILE = 'https://download.readest.com/nightly/latest.json';",
  "export const READEST_UPDATER_PUBKEY =\n  'original-key';",
  "export const READEST_WEB_BASE_URL = 'https://web.readest.com';",
].join('\n');

function evaluate(source) {
  return new Function(source.replaceAll('export ', '') +
    '\nreturn { READEST_UPDATER_FILE, READEST_CHANGELOG_FILE, READEST_NIGHTLY_UPDATER_FILE, READEST_UPDATER_PUBKEY, READEST_WEB_BASE_URL };')();
}

test('all update flows use the fork and its public key; official cloud remains unchanged', () => {
  const result = evaluate(patchUpdates(original, 'SavingBigHead/readest', 'personal-key'));
  const base = 'https://github.com/SavingBigHead/readest/releases/latest/download/';
  assert.equal(result.READEST_UPDATER_FILE, base + 'latest.json');
  assert.equal(result.READEST_CHANGELOG_FILE, base + 'release-notes.json');
  assert.equal(result.READEST_NIGHTLY_UPDATER_FILE, base + 'latest.json');
  assert.equal(result.READEST_UPDATER_PUBKEY, 'personal-key');
  assert.equal(result.READEST_WEB_BASE_URL, 'https://web.readest.com');
});

test('Windows checkout line endings are supported', () => {
  assert.equal(evaluate(patchUpdates(original.replaceAll('\n', '\r\n'), 'SavingBigHead/readest', 'key')).READEST_UPDATER_PUBKEY, 'key');
});

test('missing or duplicated upstream update declarations stop the build', () => {
  assert.throws(() => patchUpdates(original.replace('READEST_UPDATER_PUBKEY', 'RENAMED_KEY'), 'owner/repo', 'key'));
  assert.throws(() => patchUpdates(original + "\nconst LATEST_DOWNLOAD_BASE_URL = 'other';", 'owner/repo', 'key'));
});
