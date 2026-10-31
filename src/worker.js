/*!
 * Unattended character export entry point. MIT, like wow.export.
 * Trusted local queue; no HTTP server and no Blizzard account credentials.
 */
BUILD_RELEASE = true;
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const nodeCrypto = require('node:crypto');
const util = require('util');
const WORK = '/work';
let activeJob = null;
const emit = (event, data = {}) => process.stdout.write(JSON.stringify({ event, ...data }) + '\n');
const writeJSON = async (file, value) => {
	await fsp.writeFile(file + '.tmp', JSON.stringify(value, null, 2));
	await fsp.rename(file + '.tmp', file);
};
const fatal = (error) => {
	const message = error?.stack || String(error);
	emit('fatal', { job: activeJob, message });
	fs.writeFileSync(path.join(WORK, 'status.json'), JSON.stringify({ state: 'failed', job: activeJob, error: message }));
	process.exit(1);
};
crash = (code, message) => fatal(new Error(code + ': ' + message));
process.on('unhandledRejection', fatal);
process.on('uncaughtException', fatal);

(async () => {
	const started = performance.now();
	await writeJSON(path.join(WORK, 'status.json'), { state: 'starting' });
	await fsp.writeFile(path.join(WORK, 'heartbeat'), '');
	setInterval(() => fsp.writeFile(path.join(WORK, 'heartbeat'), '').catch(fatal), 10000);
	const core = require('./js/core');
	const Vue = require('vue');
	const generics = require('./js/generics');
	const constants = require('./js/constants');
	const listfile = require('./js/casc/listfile');
	const dbdManifest = require('./js/casc/dbd-manifest');
	const characters = require('./js/modules/tab_characters');
	const GLContext = require('./js/3D/gl/GLContext');
	const CASCRemote = require('./js/casc/casc-source-remote');
	const { validateJob, jobId } = require('./js/worker/job');
	const BLPImage = require('./js/casc/blp');
	const log = require('./js/log');
	const exportWarnings = [];
	const originalWrite = log.write;
	log.write = (...args) => {
		originalWrite(...args);
		const message = util.format(...args);
		if (activeJob && /failed to|unable|missing|not found/i.test(message)) exportWarnings.push(message);
	};
	for (const dir of ['inbox', 'processing', 'done', 'failed', 'results']) await fsp.mkdir(path.join(WORK, dir), { recursive: true });
	// A crashed job is never silently retried against potentially incomplete state.
	for (const file of await fsp.readdir(path.join(WORK, 'processing'))) {
		const id = jobId(file);
		await writeJSON(path.join(WORK, 'failed', id + '.result.json'), { state: 'failed', error: 'Worker interrupted; resubmit with a new job ID' });
		await fsp.rename(path.join(WORK, 'processing', file), path.join(WORK, 'failed', file));
	}
	Vue.createApp({ data: () => core.makeNewView(), created() { core.view = this; }, template: '<span>Character worker</span>' }).mount('#worker');
	core.view.config = await generics.readJSON(constants.CONFIG.DEFAULT_PATH, true);
	Object.assign(core.view.config, { exportCharacterFormat: 'GLB', modelsExportTextures: true, modelsExportAnimations: false, overwriteFiles: false, allowCacheCollection: false, chrIncludeBaseClothing: 'auto' });
	core.view.selectedCDNRegion = { tag: 'eu' };
	core.view.$watch('loadingProgress', (message) => emit('progress', { message }));
	core.view.$watch('toast', (toast) => { if (toast?.type === 'error') exportWarnings.push(toast.message); });
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = 512;
	const context = new GLContext(canvas);
	const rendererInfo = context.gl.getExtension('WEBGL_debug_renderer_info');
	const renderer = rendererInfo ? context.gl.getParameter(rendererInfo.UNMASKED_RENDERER_WEBGL) : context.gl.getParameter(context.gl.RENDERER);
	emit('starting', { renderer });
	const startupTimer = setTimeout(() => fatal(new Error('Worker initialization exceeded 20 minutes')), 1200000);
	listfile.preload();
	dbdManifest.preload();
	await require('./js/casc/tact-keys').load();
	const casc = new CASCRemote('eu');
	const memory = (phase) => emit('memory', { phase, ...process.memoryUsage(), indexes: { archives: casc.archives.size, encoding: casc.encodingKeys.size, root: casc.rootEntries.size } });
	// Distinguish the game-wide lookup footprint from character export allocations.
	for (const method of ['loadArchives', 'loadEncoding', 'loadRoot', 'loadListfile']) {
		const original = casc[method].bind(casc);
		casc[method] = async (...args) => { const value = await original(...args); memory(method); return value; };
	}
	memory('beforeCasc');
	casc.host = util.format(constants.PATCH.HOST, 'eu');
	let build;
	try { build = JSON.parse(await fsp.readFile('/cache/build.json', 'utf8')); }
	catch (e) { if (e.code !== 'ENOENT') throw e; }
	if (!build) {
		build = (await casc.getVersionConfig('wow')).find(row => row.Region === 'eu');
		if (!build) throw new Error('EU retail build unavailable');
		await writeJSON('/cache/build.json', build);
	}
	if (build.Product !== 'wow' || build.Region !== 'eu' || !/^[a-f0-9]{32}$/.test(build.BuildConfig)) throw new Error('Invalid pinned build');
	casc.builds = [build];
	await casc.load(0);
	await characters.initializeWorker(core, context);
	memory('characterTablesReady');
	clearTimeout(startupTimer);
	const identity = { build, exporterVersion: nw.App.manifest.version, workerSha256: nodeCrypto.createHash('sha256').update(await fsp.readFile('/app/src/worker.js')).digest('hex'), renderer, startupMs: Math.round(performance.now() - started) };
	// Texture jobs find BLPs by listfile pattern and/or export named ones as PNG, for website set dressing.
	const textureJob = async (job, output) => {
		const search = (job.search ?? []).slice(0, 20), wanted = (job.textures ?? []).slice(0, 64);
		if (!Array.isArray(search) || !Array.isArray(wanted)) throw new Error('Invalid texture job');
		if (search.length) {
			const names = listfile.getFilenamesByExtension(['.blp']).map(fileDataID => listfile.getByID(fileDataID)).filter(Boolean);
			const found = {};
			for (const pattern of search) {
				const expression = new RegExp(String(pattern), 'i');
				found[pattern] = names.filter(name => expression.test(name)).sort().slice(0, 600);
			}
			await writeJSON(path.join(output, 'search.json'), found);
		}
		const textures = [];
		for (const { name, file } of wanted) {
			if (!/^[a-z0-9-]{1,64}$/.test(name)) throw new Error('Invalid texture name: ' + name);
			const fileDataID = Number.isSafeInteger(file) ? file : listfile.getByFilename(String(file));
			if (!fileDataID) throw new Error('Unknown texture: ' + file);
			const blp = new BLPImage(await casc.getFile(fileDataID));
			await blp.saveToPNG(path.join(output, name + '.png'));
			textures.push({ name, file: listfile.getByID(fileDataID) ?? String(fileDataID), fileDataID, width: blp.width, height: blp.height });
		}
		return { kind: 'textures', textures, searched: search.length };
	};
	// Model jobs find doodad M2s by listfile pattern and/or export named ones as GLB with embedded textures.
	const modelJob = async (job, output) => {
		const search = (job.search ?? []).slice(0, 20), wanted = (job.models ?? []).slice(0, 32);
		if (!Array.isArray(search) || !Array.isArray(wanted)) throw new Error('Invalid model job');
		if (search.length) {
			const names = listfile.getFilenamesByExtension(['.m2']).map(fileDataID => listfile.getByID(fileDataID)).filter(Boolean);
			const found = {};
			for (const pattern of search) {
				const expression = new RegExp(String(pattern), 'i');
				found[pattern] = names.filter(name => expression.test(name)).sort().slice(0, 600);
			}
			await writeJSON(path.join(output, 'search.json'), found);
		}
		const M2Exporter = require('./js/3D/exporters/M2Exporter');
		const ExportHelper = require('./js/casc/export-helper');
		core.view.config.exportDirectory = output;
		const models = [];
		for (const { name, file } of wanted) {
			if (!/^[a-z0-9-]{1,64}$/.test(name)) throw new Error('Invalid model name: ' + name);
			const fileDataID = Number.isSafeInteger(file) ? file : listfile.getByFilename(String(file));
			if (!fileDataID) throw new Error('Unknown model: ' + file);
			const out = path.join(output, name + '.glb');
			await new M2Exporter(await casc.getFile(fileDataID), undefined, fileDataID).exportAsGLTF(out, new ExportHelper(1, 'model'), 'glb');
			models.push({ name, file: listfile.getByID(fileDataID) ?? String(fileDataID), fileDataID, bytes: (await fsp.stat(out)).size });
		}
		return { kind: 'models', models, searched: search.length };
	};
	emit('ready', identity);
	await writeJSON(path.join(WORK, 'status.json'), { state: 'ready', ...identity });
	while (true) {
		const files = (await fsp.readdir(path.join(WORK, 'inbox'))).filter(file => file.endsWith('.json')).sort();
		for (const file of files) {
			let id;
			try { id = jobId(file); } catch (e) { emit('rejected_filename', { file, error: e.message }); continue; }
			const source = path.join(WORK, 'inbox', file), claimed = path.join(WORK, 'processing', file);
			await fsp.rename(source, claimed);
			activeJob = id;
			exportWarnings.length = 0;
			const jobStart = performance.now();
			const timeout = Number(process.env.WORKER_TIMEOUT_MS || 600000);
			if (!Number.isSafeInteger(timeout) || timeout < 1000) throw new Error('Invalid WORKER_TIMEOUT_MS');
			const timer = setTimeout(() => fatal(new Error('Character job timed out')), timeout);
			let result;
			try {
				if ((await fsp.stat(claimed)).size > 2 * 1024 * 1024) throw new Error('Job exceeds 2 MB');
				const raw = JSON.parse(await fsp.readFile(claimed, 'utf8'));
				if (raw?.kind === 'textures' || raw?.kind === 'models') {
					const output = path.join(WORK, 'results', id);
					await fsp.mkdir(output);
					result = { state: 'complete', id, ...identity, ...(await (raw.kind === 'models' ? modelJob : textureJob)(raw, output)), durationMs: Math.round(performance.now() - jobStart), warnings: [...exportWarnings] };
					await writeJSON(path.join(output, 'result.json'), result);
					await fsp.rename(claimed, path.join(WORK, 'done', file));
				} else {
				const input = validateJob(raw);
				if (input.expectedBuildConfig && input.expectedBuildConfig !== build.BuildConfig) throw new Error('Job build does not match pinned worker build');
				const output = path.join(WORK, 'results', id);
				await fsp.mkdir(output); // Exclusive: job IDs must never overwrite an earlier artifact.
				core.view.config.exportDirectory = output;
				await writeJSON(path.join(output, 'appearance.json'), input);
				await writeJSON(path.join(WORK, 'status.json'), { state: 'exporting', job: id, ...identity });
				emit('exporting', { job: id });
				const detail = await characters.exportWorker(core, input.appearance, input.pose, input.weapons, input.form);
				const all = await fsp.readdir(output, { recursive: true });
				const models = all.filter(name => name.endsWith('.glb'));
				if (models.length !== 1) throw new Error('Expected exactly one exported GLB');
				const modelPath = path.join(output, models[0]);
				const bytes = await fsp.readFile(modelPath);
				if (bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) throw new Error('Invalid GLB header');
				const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8'));
				if (!gltf.meshes?.length || !gltf.images?.length || gltf.images.some(image => image.uri && !image.uri.startsWith('data:'))) throw new Error('GLB has missing or external textures');
				result = { state: 'complete', id, ...identity, ...detail, durationMs: Math.round(performance.now() - jobStart), bytes: bytes.length, model: models[0], sha256: nodeCrypto.createHash('sha256').update(bytes).digest('hex'), warnings: [...exportWarnings] };
				await writeJSON(path.join(output, 'result.json'), result);
				await fsp.rename(claimed, path.join(WORK, 'done', file));
				}
			} catch (e) {
				result = { state: 'failed', id, error: e.stack || e.message, durationMs: Math.round(performance.now() - jobStart), warnings: [...exportWarnings] };
				await writeJSON(path.join(WORK, 'failed', id + '.result.json'), result);
				await fsp.rename(claimed, path.join(WORK, 'failed', file));
			} finally { clearTimeout(timer); activeJob = null; }
			memory('jobFinished');
			emit(result.state, result);
			await writeJSON(path.join(WORK, 'status.json'), { state: 'ready', lastJob: result, ...identity });
		}
		await new Promise(resolve => setTimeout(resolve, 1000));
	}
})().catch(fatal);
