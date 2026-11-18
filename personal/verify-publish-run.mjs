import { appendFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { githubAPI } from './check-release.mjs';

export function validatePublishRun(run, jobs, repository) {
  if (run.status !== 'completed' || run.head_branch !== 'main' ||
      run.repository?.full_name !== repository || run.head_repository?.full_name !== repository ||
      run.path !== '.github/workflows/personal-release.yml' ||
      !['push', 'schedule', 'workflow_dispatch'].includes(run.event) ||
      !/^[a-f0-9]{40}$/i.test(run.head_sha ?? '')) {
    throw new Error('Only completed personal release runs from this repository main branch can be reused');
  }
  for (const name of ['cadence', 'check', 'prepare', 'verify']) {
    const matches = jobs.filter((job) => job.name === name);
    if (matches.length !== 1 || matches[0].conclusion !== 'success') {
      throw new Error('Source run did not pass ' + name);
    }
  }
  for (const platform of ['windows', 'linux', 'android']) {
    const matches = jobs.filter((job) => job.name.startsWith('build (' + platform + ','));
    if (matches.length !== 1 || matches[0].conclusion !== 'success') {
      throw new Error('Source run did not build ' + platform + ' successfully');
    }
  }
  return run.head_sha;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const id = process.argv[2];
  const repository = process.env.GITHUB_REPOSITORY;
  if (!/^\d{1,20}$/.test(id ?? '') || !/^[\w.-]+\/[\w.-]+$/.test(repository ?? '')) {
    throw new Error('Invalid source run or repository');
  }
  const route = '/repos/' + repository + '/actions/runs/' + id;
  const [run, result] = await Promise.all([githubAPI(route), githubAPI(route + '/jobs?per_page=100')]);
  if (result.total_count !== result.jobs.length) throw new Error('Incomplete source job list');
  const sha = validatePublishRun(run, result.jobs, repository);
  appendFileSync(process.env.GITHUB_ENV, 'EXPECTED_CONTROLLER_SHA=' + sha + '\n');
  console.log('Reusing verified builds from run ' + id + ' (' + sha + ')');
}
