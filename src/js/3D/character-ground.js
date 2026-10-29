// Posed, visible body/boot geometry establishes support; weapons/back pieces cannot move it.
module.exports = function characterGround(bodyVertices, bodyMeshes, equipment) {
	const surfaces = [{ vertices: bodyVertices, meshes: bodyMeshes }, ...equipment.filter(model => model.slotID === 8)];
	let groundY = Infinity, topY = -Infinity;
	const visit = callback => {
		for (const { vertices, meshes } of surfaces)
			for (const mesh of meshes)
				for (const index of mesh.triangles)
					callback(vertices[index * 3], vertices[index * 3 + 1], vertices[index * 3 + 2]);
	};
	visit((x, y, z) => { groundY = Math.min(groundY, y); topY = Math.max(topY, y); });
	if (!Number.isFinite(groundY)) return null;
	// The lower tenth gives a stable feet/seat footprint, including curved soles.
	// Bounds (rather than a vertex average) do not favor densely tessellated boots.
	const contactCeiling = groundY + (topY - groundY) * 0.1;
	let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
	visit((x, y, z) => {
		if (y > contactCeiling) return;
		minX = Math.min(minX, x); maxX = Math.max(maxX, x);
		minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
	});
	return { groundY, centerX: (minX + maxX) / 2, centerZ: (minZ + maxZ) / 2 };
};
