import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validatePublishRun } from '../verify-publish-run.mjs';

const repository = 'SavingBigHead/readest';
const run = {
  status: 'completed', event: 'push', head_branch: 'main',
  path: '.github/workflows/personal-release.yml', head_sha: 'a'.repeat(40),
  repository: { full_name: repository }, head_repository: { full_name: repository },
};
const jobs = ['cadence', 'check', 'prepare', 'verify',
  'build (windows, windows-latest, x86_64-pc-windows-msvc)',
  'build (linux, ubuntu-22.04, x86_64-unknown-linux-gnu)',
  'build (android, ubuntu-latest, aarch64-linux-android)',
].map((name) => ({ name, conclusion: 'success' }));

test('only completed personal runs with all checks and all three builds can be reused', () => {
  assert.equal(validatePublishRun(run, jobs, repository), run.head_sha);
  for (const name of jobs.map((job) => job.name)) {
    assert.throws(() => validatePublishRun(run, jobs.filter((job) => job.name !== name), repository));
    assert.throws(() => validatePublishRun(run, jobs.map((job) => job.name === name ? { ...job, conclusion: 'failure' } : job), repository));
  }
});

test('untrusted repositories, branches, workflows and events cannot provide release artifacts', () => {
  for (const change of [
    { status: 'in_progress' }, { event: 'pull_request' }, { head_branch: 'feature' },
    { path: '.github/workflows/other.yml' }, { head_sha: 'invalid\nsha' },
    { repository: { full_name: 'other/readest' } },
    { head_repository: { full_name: 'other/readest' } },
  ]) {
    assert.throws(() => validatePublishRun({ ...run, ...change }, jobs, repository));
  }
  assert.throws(() => validatePublishRun(run, [...jobs, jobs[4]], repository));
});
