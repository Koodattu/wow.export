/*!
	wow.export (https://github.com/Kruithne/wow.export)
	Authors: Kruithne <kruithne@gmail.com>
	License: MIT
*/

const log = require('../../log');
const db2 = require('../../casc/db2');
const { raceChain, selectModel } = require('./component-model-selection');
const race_fallbacks = new Map();

// maps FileDataID -> { raceID, genderIndex, classID, positionIndex }
const file_data_to_info = new Map();

let is_initialized = false;
let init_promise = null;

const GENDER_ANY = 2;

const initialize = async () => {
	if (is_initialized)
		return;

	if (init_promise)
		return init_promise;

	init_promise = (async () => {
		log.write('Loading ComponentModelFileData...');

		for (const [id, row] of await db2.ComponentModelFileData.getAllRows()) {
			file_data_to_info.set(id, {
				raceID: row.RaceID,
				genderIndex: row.GenderIndex,
				classID: row.ClassID,
				positionIndex: row.PositionIndex
			});
		}

		for (const [id, row] of await db2.ChrRaces.getAllRows()) race_fallbacks.set(id, row);

		log.write('Loaded ComponentModelFileData for %d models', file_data_to_info.size);
		is_initialized = true;
		init_promise = null;
	})();

	return init_promise;
};

/**
 * Filter a list of FileDataIDs to find the best match for race/gender
 * @param {number[]} file_data_ids - list of candidate FileDataIDs
 * @param {number} race_id - character race ID
 * @param {number} gender_index - 0=male, 1=female
 * @param {number} [fallback_race_id] - optional fallback race
 * @returns {number|null} - best matching FileDataID or null
 */
const getModelForRaceGender = (file_data_ids, race_id, gender_index, fallback_race_id = 0) => {
	const chain = raceChain(race_id, gender_index, race_fallbacks);
	if (fallback_race_id > 0) chain.push({ race: fallback_race_id, gender: gender_index });
	return selectModel(file_data_ids || [], file_data_to_info, chain);
};

/**
 * Get two models for left/right shoulders based on PositionIndex.
 * Filters by race/gender and returns models with PositionIndex 0 (left) and 1 (right).
 * @param {number[]} file_data_ids - list of candidate FileDataIDs
 * @param {number} race_id - character race ID
 * @param {number} gender_index - 0=male, 1=female
 * @returns {{left: number|null, right: number|null}}
 */
const getModelsForRaceGenderByPosition = (file_data_ids, race_id, gender_index) => {
	const result = { left: null, right: null };

	if (!file_data_ids || file_data_ids.length === 0)
		return result;

	// group candidates by positionIndex, filtering by race/gender
	const by_position = { 0: [], 1: [] };

	for (const fdid of file_data_ids) {
		const info = file_data_to_info.get(fdid);
		if (!info || (info.positionIndex !== 0 && info.positionIndex !== 1))
			continue;

		by_position[info.positionIndex].push({ fdid, info });
	}

	// helper to find best match from a list of candidates
	const find_best = candidates => getModelForRaceGender(candidates.map(c => c.fdid), race_id, gender_index);

	result.left = find_best(by_position[0]);
	result.right = find_best(by_position[1]);

	return result;
};

/**
 * Check if a FileDataID has ComponentModelFileData entry
 * @param {number} file_data_id
 * @returns {boolean}
 */
const hasEntry = (file_data_id) => {
	return file_data_to_info.has(file_data_id);
};

/**
 * Get info for a FileDataID
 * @param {number} file_data_id
 * @returns {object|null}
 */
const getInfo = (file_data_id) => {
	return file_data_to_info.get(file_data_id) || null;
};

module.exports = {
	initialize,
	getModelForRaceGender,
	getModelsForRaceGenderByPosition,
	hasEntry,
	getInfo
};
