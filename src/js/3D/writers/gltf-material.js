// Standard glTF alpha is a portable fallback; the viewer restores WoW additive modes from extras.
module.exports = function materialProperties({ blendingMode = 0, flags = 0 } = {}) {
	return {
		alphaMode: blendingMode === 0 ? 'OPAQUE' : blendingMode === 1 ? 'MASK' : 'BLEND',
		...(blendingMode === 1 ? { alphaCutoff: 0.5 } : {}),
		doubleSided: Boolean(flags & 4),
		extras: { wowM2: { version: 1, blendingMode, flags } }
	};
};
