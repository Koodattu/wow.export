const assert = require('node:assert/strict');
const test = require('node:test');
const { validateJob, appearanceEquipment, jobId } = require('../src/js/worker/job');
const job = () => ({ region: 'eu', appearance: { playable_race: { id: 86 }, playable_class: { id: 8 }, gender: { type: 'FEMALE' }, customizations: [{ option: { id: 1 }, choice: { id: 2 } }], items: [] } });
test('appearance preserves hidden items, modifier zero, and independent shoulders', () => {
	const result = appearanceEquipment([
		{ id: 168659, slot: { type: 'CHEST' }, item_appearance_modifier_id: 0 },
		{ id: 101, slot: { type: 'SHOULDER' }, item_appearance_modifier_id: 3, secondary_id: 202, secondary_item_appearance_modifier_id: 0 }
	]);
	assert.deepEqual(result, { equipment: { 5: 168659, 3: 101, 30: 202 }, equipment_skins: { 5: 0, 3: 3, 30: 0 } });
});
test('legacy armory slot indices still work and single shoulders expand', () => {
	assert.deepEqual(appearanceEquipment([{ id: 101, internal_slot_id: 2, item_appearance_modifier_id: 0 }]), { equipment: { 3: 101, 30: 101 }, equipment_skins: { 3: 0, 30: 0 } });
});
test('valid EU job accepts direct Blizzard appearance', () => { assert.equal(validateJob(job()).region, 'eu'); });
test('invalid input fails before accessing assets', () => {
	for (const mutate of [
		j => j.region = 'us',
		j => j.appearance.gender.type = 'UNKNOWN',
		j => j.appearance.playable_race.id = -1,
		j => j.appearance.items = [{ id: 1, slot: { type: 'UNKNOWN' } }],
		j => j.appearance.items = [{ id: 1, slot: { type: 'HEAD' } }, { id: 2, slot: { type: 'HEAD' } }],
		j => j.appearance.customizations = [{ option: { id: 1 }, choice: { id: '2' } }],
		j => j.expectedBuildConfig = '../bad'
	]) { const input = job(); mutate(input); assert.throws(() => validateJob(input)); }
});
test('job IDs cannot escape the output directory', () => {
	assert.equal(jobId('roidy-001.json'), 'roidy-001');
	for (const name of ['../job.json', '/job.json', 'a/b.json', '.json', 'JOB.json', 'x.json.tmp', 'x'.repeat(65) + '.json']) assert.throws(() => jobId(name));
});
