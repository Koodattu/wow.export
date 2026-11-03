const assert = require('node:assert/strict');
const test = require('node:test');
const { validateAssetJob, searchEntries } = require('../src/js/worker/asset-search');

const entries = [
	[3, 'world/generic/human/passive doodads/anvil/anvil01.m2'],
	[1, 'world/generic/dwarf/passive doodads/anvil/dwarvenanvil.m2'],
	[2, 'world/generic/gnome/passive doodads/gears/gnomegear01.m2'],
	[4, 'unknown/4.m2'],
	[5, 'world/expansion01/doodads/netherstorm/crystals/netherstormcrystal01.m2']
];

test('one pass answers every pattern, sorted, counted and capped', async () => {
	const { scanned, results } = await searchEntries(entries, ['anvil', 'crystal|gear', 'nothing'], { limit: 1 });
	assert.equal(scanned, 5);
	assert.deepEqual(results.anvil, { total: 2, files: [{ file: 'world/generic/dwarf/passive doodads/anvil/dwarvenanvil.m2', fileDataID: 1 }] });
	assert.equal(results['crystal|gear'].total, 2);
	assert.deepEqual(results.nothing, { total: 0, files: [] });
});

test('unknown placeholders never match, patterns ignore case', async () => {
	const { results } = await searchEntries(entries, ['UNKNOWN', 'ANVIL01']);
	assert.equal(results.UNKNOWN.total, 0);
	assert.equal(results.ANVIL01.files[0].fileDataID, 3);
});

test('a long pass yields to the event loop so heartbeats and timeouts still run', async () => {
	let pauses = 0;
	const many = function* () { for (let i = 0; i < 1000; i++) yield [i, `world/a/${i}.m2`]; };
	await searchEntries(many(), ['a'], { chunk: 100, pause: async () => { pauses++; } });
	assert.equal(pauses, 10);
});

test('animation export is opt-in for model jobs only', () => {
	const base = { kind: 'models', models: [{ name: 'chest', file: 'world/chest.m2' }] };
	assert.equal(validateAssetJob(base).animations, false);
	assert.equal(validateAssetJob({ ...base, animations: true }).animations, true);
	assert.equal(validateAssetJob({ ...base, animations: false }).animations, false);
	assert.throws(() => validateAssetJob({ ...base, animations: 'true' }), /animations/);
	assert.throws(() => validateAssetJob({ kind: 'textures', search: ['chest'], animations: true }), /animations/);
});

test('asset jobs are validated before any work starts', () => {
	const job = validateAssetJob({ kind: 'models', search: ['anvil'], models: [{ name: 'anvil', file: 'world/x/anvil.m2' }, { name: 'gear', file: 203164 }] });
	assert.deepEqual([job.ext, job.key, job.limit], ['.m2', 'models', 600]);
	assert.equal(validateAssetJob({ kind: 'textures', search: ['cobble'], limit: 50 }).ext, '.blp');
	for (const bad of [
		{ kind: 'sounds', search: ['x'] },
		{ kind: 'models' },
		{ kind: 'models', search: ['(unclosed'] },
		{ kind: 'models', search: [''] },
		{ kind: 'models', search: Array(21).fill('a') },
		{ kind: 'models', search: ['a'], limit: 0 },
		{ kind: 'models', models: [{ name: 'Bad Name', file: 1 }] },
		{ kind: 'models', models: [{ name: 'a', file: 1 }, { name: 'a', file: 2 }] },
		{ kind: 'models', models: [{ name: 'a', file: 'world/x/texture.blp' }] }
	]) assert.throws(() => validateAssetJob(bad), undefined, JSON.stringify(bad));
});
