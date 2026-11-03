const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { validateJob, jobId } = require('../src/js/worker/job');
const { validateAssetJob } = require('../src/js/worker/asset-search');
(async () => {
	const [inputFile, id] = process.argv.slice(2);
	if (!inputFile || !id) throw new Error('Usage: node worker/submit.cjs appearance-or-asset-job.json unique-job-id');
	jobId(id + '.json');
	const raw = JSON.parse(await fs.readFile(inputFile, 'utf8'));
	// Asset jobs (models/textures) are queued as written, once they validate.
	const input = raw.kind ? (validateAssetJob(raw), raw) : validateJob(raw.appearance ? raw : { region: 'eu', appearance: raw });
	const queue = path.join(__dirname, 'data', 'inbox');
	await fs.mkdir(queue, { recursive: true });
	const temporary = path.join(queue, id + '.' + crypto.randomUUID() + '.tmp');
	const destination = path.join(queue, id + '.json');
	await fs.writeFile(temporary, JSON.stringify(input), { flag: 'wx' });
	try {
		// The worker only sees a complete file. link also refuses an existing ID.
		await fs.link(temporary, destination);
	} finally { await fs.unlink(temporary); }
	console.log('Queued ' + id);
})().catch(error => { console.error(error.message); process.exitCode = 1; });
