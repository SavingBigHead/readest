export function patchUpdates(source, repository, publicKey) {
  source = source.replaceAll('\r\n', '\n');
  const base = 'https://github.com/' + repository + '/releases/latest/download';
  for (const [name, value] of [
    ['LATEST_DOWNLOAD_BASE_URL', base],
    ['READEST_NIGHTLY_UPDATER_FILE', base + '/latest.json'],
    ['READEST_UPDATER_PUBKEY', publicKey],
  ]) {
    const pattern = new RegExp('(\\b(?:export\\s+)?const\\s+' + name + '\\s*=\\s*)[\\s\\S]*?;', 'g');
    if ([...source.matchAll(pattern)].length !== 1) {
      throw new Error('Upstream update configuration changed: ' + name);
    }
    source = source.replace(pattern, (_match, prefix) => prefix + JSON.stringify(value) + ';');
  }
  return source;
}
