const { bakeAtlas } = require('../effect-atlas');
const ShaderMapper = require('../ShaderMapper');
const BLPFile = require('../../casc/blp');
const PNGWriter = require('../../png-writer');
const core = require('../../core');

module.exports = async function bakeEquipmentEffect(renderer, unit, triangles, replacements) {
	if (!unit || unit.textureCount !== 2) return null;
	const pixelShader = ShaderMapper.getPixelShader(2, unit.shaderID);
	const vertexShader = ShaderMapper.getVertexShader(2, unit.shaderID);
	if (!['Combiners_Mod_Mod', 'Combiners_Mod_Mod2x'].includes(pixelShader) ||
		!['Diffuse_T1_T2', 'Diffuse_EdgeFade_T1_T2'].includes(vertexShader)) return null;

	const m2 = renderer.m2, textures = [], matrices = [];
	for (let t = 0; t < 2; t++) {
		const index = m2.textureCombos[unit.textureComboIndex + t];
		const source = m2.textures[index], type = m2.textureTypes[index];
		const id = type === 0 ? source.fileDataID :
			type >= 11 && type < 14 ? replacements?.[type - 11] : replacements?.[type - 2];
		if (!id) throw new Error('Missing effect texture for shader ' + pixelShader);
		const blp = new BLPFile(await core.view.casc.getFile(id));
		textures.push({ pixels: blp.toUInt8Array(0, 15), width: blp.width, height: blp.height, flags: source.flags });
		const matrixIndex = m2.textureTransformsLookup?.[unit.textureTransformComboIndex + t];
		matrices.push(matrixIndex !== undefined && renderer.tex_matrices && matrixIndex * 16 < renderer.tex_matrices.length
			? renderer.tex_matrices.subarray(matrixIndex * 16, (matrixIndex + 1) * 16) : null);
	}

	const weight = m2.transparencyLookup?.[unit.textureWeightComboIndex];
	const result = bakeAtlas({ triangles, uv: m2.uv, uv2: m2.uv2, textures, matrices,
		factor: pixelShader === 'Combiners_Mod_Mod2x' ? 2 : 1, opacity: renderer.tex_weights?.[weight] ?? 1 });
	if (!result) throw new Error('Degenerate effect UV chart for shader ' + pixelShader);
	const png = new PNGWriter(result.width, result.height);
	png.getPixelData().set(result.pixels);
	return { uv: result.uv, png: png.getBuffer() };
};
