const characterGround = require('./character-ground');

// Cat dance poses can put the transparent hock fur below the soles. Use the
// visible vertices weighted to FootL/FootR (and toe descendants) for support.
module.exports = function pawGround(model, bones, posedVertices, skin, mask) {
 const feet = new Set();
 for (let i = 0; i < bones.length; i++) {
  let bone = i;
  while (bone >= 0 && bone < bones.length) {
   if (bones[bone].boneID === 59 || bones[bone].boneID === 60) { feet.add(i); break; }
   bone = bones[bone].parentBone;
  }
 }
 const indices = new Set();
 for (let meshIndex = 0; meshIndex < skin.subMeshes.length; meshIndex++) {
  if (!mask[meshIndex]?.checked) continue;
  const mesh = skin.subMeshes[meshIndex];
  for (let t = mesh.triangleStart; t < mesh.triangleStart + mesh.triangleCount; t++) {
   const index = skin.indices[skin.triangles[t]];
   let weight = 0;
   for (let b = 0; b < 4; b++)
    if (feet.has(model.boneIndices[index * 4 + b])) weight += model.boneWeights[index * 4 + b];
   if (weight >= 128) indices.add(index);
  }
 }
 return characterGround(posedVertices, [{triangles:[...indices]}], []);
};
