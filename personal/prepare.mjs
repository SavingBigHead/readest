import { cpSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { patchAccess } from './patch-access.mjs';
import { patchUpdates } from './patch-updates.mjs';

const controller = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(process.argv[2]);
const app = path.join(root, 'apps/readest-app');
const readJSON = (file) => JSON.parse(readFileSync(file, 'utf8'));
const writeJSON = (file, data) => writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
const { revision } = readJSON(path.join(controller, 'revision.json'));
if (!Number.isSafeInteger(revision) || revision < 1) throw new Error('Invalid personal revision');
const pkg = readJSON(path.join(app, 'package.json'));
const upstreamVersion = pkg.version;
if (process.env.UPSTREAM_TAG !== 'v' + upstreamVersion) throw new Error('Release tag and package version differ');
const repository = process.env.GITHUB_REPOSITORY;
if (!/^[\w.-]+\/[\w.-]+$/.test(repository ?? '')) throw new Error('Missing fork repository');
const pubkey = readFileSync(path.join(controller, 'updater.pub'), 'utf8').trim();
if (!pubkey) throw new Error('Missing personal updater public key');

const workflow = readFileSync(path.join(root, '.github/workflows/release.yml'), 'utf8');
const cefRevision = workflow.match(/rev=([a-f0-9]{40})/)?.[1];
const ndkVersions = new Set([...workflow.matchAll(/ndk[;/](\d+\.\d+\.\d+)/g)].map((match) => match[1]));
if (!cefRevision || ndkVersions.size !== 1) throw new Error('Upstream Linux/Android toolchain changed; review build setup');

const accessFile = path.join(app, 'src/utils/access.ts');
writeFileSync(accessFile, patchAccess(readFileSync(accessFile, 'utf8')));
const constantsFile = path.join(app, 'src/services/constants.ts');
writeFileSync(constantsFile, patchUpdates(readFileSync(constantsFile, 'utf8'), repository, pubkey));
pkg.version += '-personal.' + revision;
writeJSON(path.join(app, 'package.json'), pkg);
const configFile = path.join(app, 'src-tauri/tauri.conf.json');
const config = readJSON(configFile);
config.productName = 'Readest Personal';
config.build.beforeBuildCommand = 'pnpm build';
config.plugins.updater.pubkey = pubkey;
config.plugins.updater.endpoints = [
  'https://github.com/' + repository + '/releases/latest/download/latest.json',
];
config.bundle.createUpdaterArtifacts = true;
// Android keeps the namespace expected by MainActivity and native plugins.
// Desktop gets a separate identifier; Android gets applicationIdSuffix after init.
writeJSON(configFile, config);
let env = readFileSync(path.join(app, '.env.tauri'), 'utf8');
env = env.replace(/^DBUS_ID=.*$/m, 'DBUS_ID=com.bilingify.readest.personal');
writeFileSync(path.join(app, '.env.tauri'), env.trimEnd() + '\nNEXT_PUBLIC_PERSONAL_EDITION=true\n');
const notesFile = path.join(app, 'release-notes.json');
const notes = readJSON(notesFile);
notes.releases[pkg.version] = notes.releases[upstreamVersion] ?? {
  notes: ['Readest Personal based on official ' + upstreamVersion],
};
writeJSON(notesFile, notes);
cpSync(controller, path.join(root, 'personal'), { recursive: true });
writeJSON(path.join(root, 'personal/desktop.conf.json'), {
  identifier: 'com.bilingify.readest.personal',
  productName: 'Readest Personal',
});
const metadata = {
  upstream_tag: process.env.UPSTREAM_TAG,
  upstream_sha: execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  controller_sha: process.env.GITHUB_SHA,
  repository,
  version: pkg.version,
  release_tag: 'personal-' + process.env.UPSTREAM_TAG + '-r' + revision,
  cef_cli_rev: cefRevision,
  ndk_version: [...ndkVersions][0],
};
writeJSON(path.join(root, 'personal/build.json'), metadata);
console.log('Prepared ' + metadata.release_tag + ' from ' + metadata.upstream_sha);
