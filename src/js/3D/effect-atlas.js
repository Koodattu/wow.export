// Bake two-texture M2 effects into RGBA while preserving their two UV sets.
function sample(tex, u, v, out) {
	const x = u * tex.width - .5, y = v * tex.height - .5;
	const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
	const address = (n, size, repeat) => repeat ? ((n % size) + size) % size : Math.max(0, Math.min(size - 1, n));
	const x0 = address(ix, tex.width, tex.flags & 1), x1 = address(ix + 1, tex.width, tex.flags & 1);
	const y0 = address(iy, tex.height, tex.flags & 2), y1 = address(iy + 1, tex.height, tex.flags & 2);
	const a = (y0 * tex.width + x0) * 4, b = (y0 * tex.width + x1) * 4;
	const c = (y1 * tex.width + x0) * 4, d = (y1 * tex.width + x1) * 4, p = tex.pixels;
	for (let k = 0; k < 4; k++)
		out[k] = ((p[a+k] * (1-fx) + p[b+k] * fx) * (1-fy) + (p[c+k] * (1-fx) + p[d+k] * fx) * fy) / 255;
}
function bakeAtlas({ triangles, uv, uv2, textures, matrices = [], factor = 1, opacity = 1, size = 1024 }) {
	const used = [...new Set(triangles)];
	const bounds = chart => {
		const min = [Infinity, Infinity], max = [-Infinity, -Infinity];
		for (const i of used) for (let k = 0; k < 2; k++) {
			min[k] = Math.min(min[k], chart[i*2+k]);
			max[k] = Math.max(max[k], chart[i*2+k]);
		}
		return max[0]-min[0] < 1e-8 || max[1]-min[1] < 1e-8 ? null : {min, max};
	};
	let chart = uv2 || uv, extent = bounds(chart);
	// A constant/linear second UV set can intentionally sample a mask. Use the
	// first UV set for packing while still sampling each texture with its own UVs.
	if (!extent && uv2) { chart = uv; extent = bounds(chart); }
	if (!extent) return null;
	const {min, max} = extent;
	const resultUV = new Float32Array(uv.length);
	for (const i of used) for (let k = 0; k < 2; k++)
		resultUV[i*2+k] = (2 + (chart[i*2+k]-min[k]) / (max[k]-min[k]) * (size-4)) / size;
	const coords = textures.map((_, t) => {
		const source = t === 0 ? uv : (uv2 || uv), m = matrices[t], out = new Float64Array(uv.length);
		for (const i of used) {
			const x = source[i*2], y = source[i*2+1];
			out[i*2] = m ? m[0]*x + m[4]*y + m[12] : x;
			out[i*2+1] = m ? m[1]*x + m[5]*y + m[13] : y;
		}
		return out;
	});
	const pixels = new Uint8Array(size*size*4), first = new Float64Array(4), second = new Float64Array(4);
	const seen = new Set(), written = new Uint8Array(size * size);
	// Reverse traversal preserves last-face-wins overlap without sampling pixels repeatedly.
	for (let t = triangles.length - 3; t >= 0; t -= 3) {
		const ids = Array.from(triangles.slice(t, t+3));
		// Effect ribbons often repeat the exact same UV mapping on many faces.
		const key = ids.map(i => [resultUV[i*2], resultUV[i*2+1], ...coords.flatMap(c => [c[i*2], c[i*2+1]])].join(',')).sort().join(';');
		if (seen.has(key)) continue;
		seen.add(key);
		const [a,b,c] = ids.map(i => [resultUV[i*2]*size, resultUV[i*2+1]*size]);
		const den = (b[1]-c[1])*(a[0]-c[0]) + (c[0]-b[0])*(a[1]-c[1]);
		if (Math.abs(den) < 1e-8) continue;
		const x0 = Math.max(0, Math.floor(Math.min(a[0],b[0],c[0]))), x1 = Math.min(size-1, Math.ceil(Math.max(a[0],b[0],c[0])));
		const y0 = Math.max(0, Math.floor(Math.min(a[1],b[1],c[1]))), y1 = Math.min(size-1, Math.ceil(Math.max(a[1],b[1],c[1])));
		const [i,j,k] = ids.map(i => i*2), u = coords[0], v = coords[1];
		for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
			if (written[y*size+x]) continue;
			const w0 = ((b[1]-c[1])*(x+.5-c[0]) + (c[0]-b[0])*(y+.5-c[1])) / den;
			const w1 = ((c[1]-a[1])*(x+.5-c[0]) + (a[0]-c[0])*(y+.5-c[1])) / den, w2 = 1-w0-w1;
			if (Math.min(w0,w1,w2) < -1e-6) continue;
			written[y*size+x] = 1;
			sample(textures[0], u[i]*w0+u[j]*w1+u[k]*w2, u[i+1]*w0+u[j+1]*w1+u[k+1]*w2, first);
			sample(textures[1], v[i]*w0+v[j]*w1+v[k]*w2, v[i+1]*w0+v[j+1]*w1+v[k+1]*w2, second);
			for (let ch = 0; ch < 4; ch++) pixels[(y*size+x)*4+ch] = Math.round(255*Math.min(1,first[ch]*second[ch]*factor*(ch === 3 ? opacity : 1)));
		}
	}
	return { uv: resultUV, pixels, width: size, height: size };
}
module.exports = { bakeAtlas };
