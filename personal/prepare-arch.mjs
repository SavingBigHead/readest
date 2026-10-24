import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function archVersion(version) {
  const match = /^(\d+\.\d+\.\d+)-personal\.([1-9]\d*)$/.exec(version);
  if (!match) throw new Error('Expected a personal release version for Arch packaging');
  return match[1] + '.personal.' + match[2];
}

export function archPackageName(version) {
  return 'readest-personal-bin-' + archVersion(version) + '-1-x86_64.pkg.tar.zst';
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const root = path.resolve(process.argv[2]);
  const dist = path.resolve(process.argv[3]);
  const destination = path.resolve(process.argv[4]);
  const { version } = JSON.parse(readFileSync(path.join(root, 'personal/build.json'), 'utf8'));
  let recipe = readFileSync(new URL('./arch/PKGBUILD', import.meta.url), 'utf8');
  recipe = recipe.replace('@PKGVER@', archVersion(version));
  mkdirSync(destination, { recursive: true });
  for (const [input, output, placeholder] of [
    [path.join(dist, 'Readest-Personal_' + version + '_linux-x64.deb'), 'readest-personal.deb', '@DEB_SHA256@'],
    [path.join(root, 'LICENSE'), 'LICENSE', '@LICENSE_SHA256@'],
  ]) {
    const digest = createHash('sha256').update(readFileSync(input)).digest('hex');
    copyFileSync(input, path.join(destination, output));
    recipe = recipe.replace(placeholder, digest);
  }
  writeFileSync(path.join(destination, 'PKGBUILD'), recipe);
  console.log('Prepared ' + archPackageName(version));
}
