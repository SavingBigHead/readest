import assert from 'node:assert/strict';
import { test } from 'node:test';
import { githubAPI } from '../check-release.mjs';

test('GitHub errors retain the method, server reason and required permissions without logging tokens', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => Response.json({ message: 'Resource not accessible by integration' }, {
    status: 403, headers: { 'x-accepted-github-permissions': 'contents=write;workflows=write' },
  });
  await assert.rejects(githubAPI('/repos/owner/repo/releases', { method: 'POST' }), (error) => {
    assert.match(error.message, /GitHub 403 POST/);
    assert.match(error.message, /Resource not accessible by integration/);
    assert.match(error.message, /workflows=write/);
    assert.ok(!error.message.includes('Authorization'));
    return true;
  });
});
