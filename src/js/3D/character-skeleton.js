// A body-fitted mesh uses several named character bones in character space.
// Rigid weapons/backpacks may have their own skeleton and must stay attached.
function usesCharacterSkeleton(model, bones, characterBones) {
	if (!bones || !characterBones || !model.boneIndices || !model.boneWeights) return false;
	const used = new Set();
	for (let i = 0; i < model.boneIndices.length; i++)
		if (model.boneWeights[i] > 0) used.add(model.boneIndices[i]);
	if (used.size < 2) return false;
	return [...used].every(index => {
		const bone = bones[index];
		return bone?.boneNameCRC && characterBones.some(target => target.boneNameCRC === bone.boneNameCRC &&
			bone.pivot.every((value, axis) => Math.abs(value - target.pivot[axis]) < 0.0001));
	});
}
module.exports = { usesCharacterSkeleton };
