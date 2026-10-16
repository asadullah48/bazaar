import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../../', import.meta.url));
const screenshots = [];
const versions = {};
for (const phase of ['before', 'after']) {
  const log = await fs.readFile(path.join(repo, 'docs', `frontend-${phase}.txt`), 'utf8');
  versions[phase] = log.match(/Next\.js\s+([\d.]+)/)?.[1] ?? null;
  const directory = path.join(repo, 'docs', 'storefront', phase);
  for (const filename of (await fs.readdir(directory)).filter(name => name.endsWith('.png')).sort()) {
    const match = filename.match(/^(en|ar)-(1440|390)-(home|search|product|cart|checkout)\.png$/);
    if (!match) throw new Error(`Unexpected screenshot name: ${filename}`);
    const image = await fs.readFile(path.join(directory, filename));
    screenshots.push({ file: `docs/storefront/${phase}/${filename}`, phase, locale: match[1], viewportWidth: Number(match[2]), page: match[3], imageWidth: image.readUInt32BE(16), imageHeight: image.readUInt32BE(20) });
  }
}
const summary = {
  fixture: 'Clearly labelled DEMO catalog; not live marketplace activity',
  framework: versions,
  before: screenshots.filter(item => item.phase === 'before').length,
  after: screenshots.filter(item => item.phase === 'after').length,
  widerThanViewport: Object.fromEntries(['before', 'after'].map(phase => [phase, screenshots.filter(item => item.phase === phase && item.imageWidth > item.viewportWidth).length])),
  screenshots,
};
await fs.writeFile(path.join(repo, 'docs', 'storefront', 'screenshots.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ framework: versions, before: summary.before, after: summary.after, widerThanViewport: summary.widerThanViewport }));
if (versions.before !== '14.2.35' || versions.after !== '14.2.35' || summary.before !== 20 || summary.after !== 20) process.exitCode = 1;
