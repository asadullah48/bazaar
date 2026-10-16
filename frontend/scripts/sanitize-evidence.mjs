import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../../', import.meta.url));
const evidenceDir = path.join(repo, 'docs', 'storefront');
const reportPath = path.join(evidenceDir, 'evidence-hygiene.json');
const roots = [
  [process.env.BAZAAR_BUILD_ROOT, '[build]'],
  [process.env.BAZAAR_BASELINE_ROOT, '[baseline]'],
  [repo.replace(/[\\/]$/, ''), '[repo]'],
  [os.homedir(), '[user]'],
  [path.dirname(process.execPath), '[node-runtime]'],
].filter(([value]) => value).sort((a, b) => b[0].length - a[0].length);
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const forbidden = /\b[A-Za-z]:(?:\\|\/)+|OneDrive/gi;
const files = [];
async function walk(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(target);
    else if (target !== reportPath) files.push(target);
  }
}
await walk(evidenceDir);
for (const name of ['STOREFRONT-PHASE-1.md', 'backend-before.txt', 'backend-before.xml', 'backend-after.txt', 'backend-after.xml', 'backend-regressions.txt', 'backend-regressions.xml', 'backend-collection-after.txt', 'frontend-before.txt', 'frontend-after.txt']) {
  const target = path.join(repo, 'docs', name);
  try { await fs.access(target); files.push(target); } catch { /* Not generated yet. */ }
}
let redactedFiles = 0, screenshotsChecked = 0, metadataChunksRemoved = 0;
for (const file of files) {
  if (file.endsWith('.png')) {
    const source = await fs.readFile(file);
    const chunks = [source.subarray(0, 8)];
    for (let offset = 8; offset < source.length;) {
      const length = source.readUInt32BE(offset);
      const type = source.toString('ascii', offset + 4, offset + 8);
      const end = offset + 12 + length;
      if (end > source.length) throw new Error(`Invalid PNG: ${path.basename(file)}`);
      if (['tEXt', 'zTXt', 'iTXt', 'eXIf'].includes(type)) metadataChunksRemoved++;
      else chunks.push(source.subarray(offset, end));
      offset = end;
    }
    await fs.writeFile(file, Buffer.concat(chunks));
    screenshotsChecked++;
    continue;
  }
  if (!/\.(txt|json|xml|md|html|svg)$/i.test(file)) continue;
  const original = await fs.readFile(file, 'utf8');
  let text = original;
  for (const [directory, alias] of roots) {
    const windows = directory.replaceAll('/', '\\');
    const variants = new Set([directory, windows, windows.replaceAll('\\', '\\\\'), directory.replaceAll('\\', '/'), encodeURIComponent(directory), encodeURIComponent(windows)]);
    for (const variant of variants) text = text.replace(new RegExp(escape(variant), 'gi'), alias);
  }
  text = text.replace(/[A-Za-z]:(?:\\|\/)+Users(?:\\|\/)+[^\\/\s"']+/gi, '[user]').replace(/OneDrive/gi, '[cloud-folder]');
  if (text !== original) { await fs.writeFile(file, text); redactedFiles++; }
}
const remaining = [];
for (const file of files) {
  if (/\.(txt|json|xml|md|html|svg)$/i.test(file)) {
    forbidden.lastIndex = 0;
    if (forbidden.test(await fs.readFile(file, 'utf8'))) remaining.push(path.relative(repo, file).replaceAll('\\', '/'));
  }
}
const report = { filesChecked: files.length + 1, screenshotsChecked, metadataChunksRemoved, redactedFiles, remainingMatches: remaining.length, files: files.map(file => path.relative(repo, file).replaceAll('\\', '/')).sort(), remaining };
const serialized = JSON.stringify(report, null, 2);
forbidden.lastIndex = 0;
if (forbidden.test(serialized)) throw new Error('Evidence hygiene report contains a machine-specific path');
await fs.writeFile(reportPath, serialized);
console.log(JSON.stringify({ filesChecked: report.filesChecked, screenshotsChecked, metadataChunksRemoved, redactedFiles, remainingMatches: remaining.length }));
if (remaining.length) process.exitCode = 1;
