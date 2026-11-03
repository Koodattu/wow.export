const { SHOULDER_SLOT_L, SHOULDER_SLOT_R } = require('../wow/EquipmentSlots');
const SLOT_IDS = { HEAD: 1, NECK: 2, SHOULDER: 3, SHIRT: 4, CHEST: 5, WAIST: 6, LEGS: 7, FEET: 8, WRIST: 9, HANDS: 10, FINGER_1: 11, FINGER_2: 12, TRINKET_1: 13, TRINKET_2: 14, BACK: 15, MAIN_HAND: 16, OFF_HAND: 17, RANGED: 18, TABARD: 19 };
const integer = (value, min = 0) => Number.isSafeInteger(value) && value >= min;
// Recipe exceptions override the default; Evokers retain their dragon form.
function resolveCharacterForm(appearance, form) {
	const dracthyr = [52, 70].includes(appearance.playable_race.id);
	if (form !== undefined && !['cat', 'visage', 'dracthyr'].includes(form)) throw new Error('Unsupported character form');
	if (form === 'cat' && appearance.playable_class.id !== 11) throw new Error('Cat form requires a druid');
	if (['visage', 'dracthyr'].includes(form) && !dracthyr) throw new Error('Visage/dracthyr form requires a Dracthyr');
	return form ?? (dracthyr ? (appearance.playable_class.id === 13 ? 'dracthyr' : 'visage') : undefined);
}
function validateWeaponStates(states) {
	if (states === undefined) return;
	if (!states || typeof states !== 'object' || Array.isArray(states) ||
		Object.entries(states).some(([hand, state]) => !['mainHand', 'offHand'].includes(hand) || !['held', 'sheathed', 'hidden'].includes(state)))
		throw new Error('Invalid per-hand weapon placement');
}
function validateJob(input) {
	if (!input || input.region !== 'eu') throw new Error('region must be eu');
	if (input.pose !== undefined && (!input.pose || !integer(input.pose.animationId) || !integer(input.pose.variation ?? 0) || !integer(input.pose.timeMs ?? 0) || input.pose.timeMs > 600000)) throw new Error('Invalid pose');
	if (input.weapons !== undefined && !['held', 'sheathed', 'hidden'].includes(input.weapons)) throw new Error('Invalid weapon placement');
	validateWeaponStates(input.weaponStates);
	const a = input.appearance;
	if (!a || !integer(a.playable_race?.id, 1) || !integer(a.playable_class?.id, 1) || !['MALE', 'FEMALE'].includes(a.gender?.type))
		throw new Error('Invalid race, class, or gender');
	if (!Array.isArray(a.items) || a.items.length > 32 || !Array.isArray(a.customizations) || a.customizations.length > 1024)
		throw new Error('Invalid appearance arrays');
	const slots = new Set();
	for (const item of a.items) {
		const slot = SLOT_IDS[item.slot?.type] ?? (integer(item.internal_slot_id) ? item.internal_slot_id + 1 : undefined);
		if (!slot || slot > 19 || slots.has(slot) || !integer(item.id, 1)) throw new Error('Invalid or duplicate equipment slot');
		slots.add(slot);
		for (const key of ['item_appearance_modifier_id', 'secondary_item_appearance_modifier_id', 'secondary_id'])
			if (item[key] !== undefined && !integer(item[key])) throw new Error('Invalid item appearance value');
	}
	for (const c of a.customizations)
		if (!integer(c.option?.id, 1) || !integer(c.choice?.id, 1)) throw new Error('Invalid customization');
	if (input.expectedBuildConfig !== undefined && !/^[a-f0-9]{32}$/.test(input.expectedBuildConfig))
		throw new Error('Invalid expectedBuildConfig');
	const form = resolveCharacterForm(a, input.form);
	return form === undefined ? input : { ...input, form };
}
function appearanceEquipment(items) {
	const equipment = {}, equipment_skins = {};
	for (const item of items || []) {
		const slot = SLOT_IDS[item.slot?.type] ?? item.internal_slot_id + 1;
		equipment[slot] = item.id;
		if (item.item_appearance_modifier_id !== undefined)
			equipment_skins[slot] = item.item_appearance_modifier_id;
		if (slot === SHOULDER_SLOT_L) {
			equipment[SHOULDER_SLOT_R] = item.secondary_id ?? item.id;
			const modifier = item.secondary_id === undefined ? item.item_appearance_modifier_id : item.secondary_item_appearance_modifier_id;
			if (modifier !== undefined) equipment_skins[SHOULDER_SLOT_R] = modifier;
		}
	}
	return { equipment, equipment_skins };
}
function jobId(filename) {
	if (!/^[a-z0-9][a-z0-9_-]{0,63}\.json$/.test(filename)) throw new Error('Job filename must be a unique lowercase ID.json');
	return filename.slice(0, -5);
}
module.exports = { validateJob, appearanceEquipment, jobId, resolveCharacterForm, validateWeaponStates };
