// Component model fallbacks are supplied by ChrRaces, including body type.
function raceChain(race, gender, races) {
	const chain = [], visited = new Set();
	while (race > 0 && !visited.has(race + ':' + gender)) {
		visited.add(race + ':' + gender);
		chain.push({ race, gender });
		const row = races.get(race);
		const prefix = gender === 1 ? 'Female' : 'Male';
		race = row?.[prefix + 'ModelFallbackRaceID'] || 0;
		const nextGender = row?.[prefix + 'ModelFallbackSex'];
		if (nextGender === 0 || nextGender === 1) gender = nextGender;
	}
	return chain;
}
function selectModel(ids, infoById, chain) {
	for (const { race, gender } of chain) {
		for (const matchGender of [gender, 2]) {
			const match = ids.find(id => { const info = infoById.get(id); return info?.raceID === race && info.genderIndex === matchGender; });
			if (match !== undefined) return match;
		}
	}
	const gender = chain[0]?.gender;
	for (const matchGender of [gender, 2]) {
		const match = ids.find(id => { const info = infoById.get(id); return info?.raceID === 0 && info.genderIndex === matchGender; });
		if (match !== undefined) return match;
	}
	// Non-component models (e.g. weapons) have no race/body restriction.
	return ids.find(id => !infoById.has(id)) ?? null;
}
module.exports = { raceChain, selectModel };
