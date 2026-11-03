// Asset jobs: { kind: 'models' | 'textures', search?: [regex], limit?, models|textures?: [{ name, file }] }.
// Validation and the listfile search live here, apart from CASC, so they are testable without game data.
const KINDS = {
	models: { ext: '.m2', key: 'models', max: 32 },
	textures: { ext: '.blp', key: 'textures', max: 64 }
};
const MAX_PATTERNS = 20, MAX_PATTERN_LENGTH = 200, DEFAULT_LIMIT = 600, MAX_LIMIT = 5000;

function validateAssetJob(input) {
	const kind = KINDS[input?.kind];
	if (!kind) throw new Error('kind must be models or textures');
	if (input.animations !== undefined && (input.kind !== 'models' || typeof input.animations !== 'boolean'))
		throw new Error('animations must be a boolean on model jobs');
	const search = input.search ?? [], wanted = input[kind.key] ?? [], limit = input.limit ?? DEFAULT_LIMIT;
	if (!Array.isArray(search) || search.length > MAX_PATTERNS) throw new Error(`search must be an array of at most ${MAX_PATTERNS} patterns`);
	if (!Array.isArray(wanted) || wanted.length > kind.max) throw new Error(`${kind.key} must be an array of at most ${kind.max} entries`);
	if (!search.length && !wanted.length) throw new Error(`Nothing to do: give search patterns and/or ${kind.key}`);
	if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT) throw new Error(`limit must be 1-${MAX_LIMIT}`);
	for (const pattern of search) {
		if (typeof pattern !== 'string' || !pattern || pattern.length > MAX_PATTERN_LENGTH) throw new Error(`Search patterns must be strings of 1-${MAX_PATTERN_LENGTH} characters`);
		try { new RegExp(pattern, 'i'); } catch (e) { throw new Error(`Invalid search pattern ${JSON.stringify(pattern)}: ${e.message}`); }
	}
	const names = new Set();
	for (const entry of wanted) {
		if (!/^[a-z0-9-]{1,64}$/.test(entry?.name ?? '')) throw new Error(`Invalid ${kind.key} name: ${JSON.stringify(entry?.name)}`);
		if (names.has(entry.name)) throw new Error(`Duplicate ${kind.key} name: ${entry.name}`);
		names.add(entry.name);
		const byId = Number.isSafeInteger(entry.file) && entry.file > 0;
		if (!byId && !(typeof entry.file === 'string' && entry.file.toLowerCase().endsWith(kind.ext)))
			throw new Error(`${entry.name}: file must be a fileDataID or a ${kind.ext} path`);
	}
	return { kind: input.kind, ext: kind.ext, key: kind.key, search, wanted, limit, animations: input.animations ?? false };
}

// One pass over `entries` ([fileDataID, filename] pairs, e.g. listfile.getEntries('.m2')) for every
// pattern. Every match is counted; up to `limit` per pattern are kept, sorted by path. The pass
// yields to the event loop every `chunk` entries so heartbeats and the job timeout keep running.
async function searchEntries(entries, patterns, { limit = DEFAULT_LIMIT, chunk = 50000, pause = () => new Promise(resolve => setImmediate(resolve)) } = {}) {
	const tests = patterns.map(pattern => new RegExp(pattern, 'i'));
	const found = patterns.map(() => []);
	let scanned = 0;
	for (const [fileDataID, file] of entries) {
		if (++scanned % chunk === 0) await pause();
		// Placeholders for files the listfile cannot name.
		if (file.startsWith('unknown/')) continue;
		for (let i = 0; i < tests.length; i++) if (tests[i].test(file)) found[i].push({ file, fileDataID });
	}
	const results = {};
	patterns.forEach((pattern, i) => {
		const files = found[i].sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
		results[pattern] = { total: files.length, files: files.slice(0, limit) };
	});
	return { scanned, results };
}

module.exports = { validateAssetJob, searchEntries, KINDS, DEFAULT_LIMIT, MAX_LIMIT };
