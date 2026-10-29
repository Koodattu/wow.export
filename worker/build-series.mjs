import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { validateSeries, localOrigin } from './series.cjs';
import { validateJob } from '../src/js/worker/job.js';
import { optimize } from './optimizer/optimize.mjs';

const root = path.resolve(import.meta.dirname, '..');
const data = path.join(import.meta.dirname, 'data');
const compose = ['compose', '-f', path.join(import.meta.dirname, 'compose.yaml')];
const json = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const save = async (file, value) => {
  await fs.writeFile(file + '.tmp', JSON.stringify(value, null, 2));
  await fs.rename(file + '.tmp', file);
};
const docker = args => new Promise((resolve, reject) => {
  const child = spawn('docker', [...compose, ...args], { cwd: root, stdio: 'inherit', shell: false });
  child.once('error', reject);
  child.once('exit', code => code === 0 ? resolve() : reject(new Error('Docker command failed (' + code + ')')));
});
async function waitForJob(id) {
  const end = Date.now() + 11 * 60 * 1000;
  while (Date.now() < end) {
    try { return await json(path.join(data, 'results', id, 'result.json')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    try {
      const failed = await json(path.join(data, 'failed', id + '.result.json'));
      throw new Error(failed.error);
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const status = await json(path.join(data, 'status.json'));
    if (status.state === 'failed') throw new Error(status.error);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('Timed out waiting for character export');
}
async function main() {
  const [configFile, originArgument = 'http://127.0.0.1:3015'] = process.argv.slice(2);
  if (!configFile) throw new Error('Usage: node worker/build-series.mjs <series.json> [local-lab-origin]');
  const series = validateSeries(await json(configFile));
  const origin = localOrigin(originArgument);
  await fs.mkdir(data, { recursive: true });
  const lock = path.join(data, 'series-build.lock');
  const lockHandle = await fs.open(lock, 'wx');
  await lockHandle.writeFile(JSON.stringify({ pid: process.pid, series: series.id }));
  await lockHandle.close();
  let output, manifest, started = false;
  try {
    for (const directory of ['inbox', 'processing']) {
      await fs.mkdir(path.join(data, directory), { recursive: true });
      if ((await fs.readdir(path.join(data, directory))).some(name => name.endsWith('.json')))
        throw new Error('Finish existing worker jobs before building a series');
    }
    await fs.mkdir(path.join(data, 'series'), { recursive: true });
    output = path.join(data, 'series', series.id);
    await fs.mkdir(output); // Never overwrite a previously frozen series.
    for (const dir of ['models', 'sources']) await fs.mkdir(path.join(output, dir));
    manifest = { schemaVersion: 1, id: series.id, title: series.title, region: 'eu', createdAt: new Date().toISOString(), state: 'building', characters: [] };
    await save(path.join(output, 'series.json'), manifest);
    await save(path.join(output, 'selection.json'), series);
    const snapshots = new Map();
    for (const character of series.characters) {
      const key = character.realm + '/' + character.name;
      if (snapshots.has(key)) continue;
      console.log('Fetching appearance: ' + key);
      const url = new URL('/api/figurine-lab/character', origin);
      url.searchParams.set('name', character.name); url.searchParams.set('realm', character.realm);
      const response = await fetch(url, { signal: AbortSignal.timeout(90000), redirect: 'error' });
      if (!response.ok) throw new Error('Character lookup failed for ' + key + ': HTTP ' + response.status);
      const snapshot = await response.json();
      validateJob({ region: 'eu', appearance: snapshot.appearance });
      snapshots.set(key, snapshot);
    }
    started = true;
    await docker(['up', '-d', '--build', '--wait', '--wait-timeout', '1200', 'worker']);
    const status = await json(path.join(data, 'status.json'));
    if (status.state !== 'ready') throw new Error('Worker is not ready');
    manifest.build = status.build;
    for (const character of series.characters) {
      console.log('Building ' + character.id + ' (' + (manifest.characters.length + 1) + '/' + series.characters.length + ')');
      const snapshot = snapshots.get(character.realm + '/' + character.name);
      const input = validateJob({ region: 'eu', appearance: snapshot.appearance, pose: character.pose, weapons: character.weapons, form: character.form, expectedBuildConfig: status.build.BuildConfig });
      const id = 'series-' + crypto.randomUUID();
      await save(path.join(data, 'inbox', id + '.json'), input);
      const result = await waitForJob(id);
      if (result.state !== 'complete') throw new Error('Export did not complete');
      const raw = path.resolve(data, 'results', id, result.model);
      if (!raw.startsWith(path.join(data, 'results', id) + path.sep)) throw new Error('Export path escapes job');
      const model = 'models/' + character.id + '.glb';
      const compressed = await optimize(raw, path.join(output, model));
      await save(path.join(output, 'sources', character.id + '.json'), { snapshot, export: result, optimization: compressed });
      manifest.characters.push({
        ...character, name: snapshot.name, realm: snapshot.realm, race: snapshot.race, characterClass: snapshot.characterClass,
        fetchedAt: snapshot.fetchedAt, referenceImage: snapshot.renderUrl, pose: result.pose, ...(result.form ? {form:result.form} : {}),
        model, bytes: compressed.bytes, sha256: compressed.sha256,
        source: 'sources/' + character.id + '.json', state: 'needs-review',
        warnings: result.warnings, validationWarnings: compressed.validation.numWarnings,
      });
      await save(path.join(output, 'series.json'), manifest);
    }
    manifest.state = 'needs-review';
    manifest.completedAt = new Date().toISOString();
    await save(path.join(output, 'series.json'), manifest);
    console.log('Built local series for visual review: ' + output);
  } catch (error) {
    if (manifest && output) {
      manifest.state = 'failed'; manifest.error = error.message;
      await save(path.join(output, 'series.json'), manifest);
    }
    throw error;
  } finally {
    try { if (started) await docker(['stop', 'worker']); }
    finally { await fs.unlink(lock); }
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
