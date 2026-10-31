const test = require('node:test');
const assert = require('node:assert/strict');
const { bakeAtlas } = require('../src/js/3D/effect-atlas');
const texture = (pixels, width = 1, height = 1) => ({ pixels: new Uint8Array(pixels), width, height, flags: 0 });
const quad = { triangles: [0, 1, 2, 1, 3, 2], uv: [0, 0, 1, 0, 0, 1, 1, 1], uv2: [0, 0, 1, 0, 0, 1, 1, 1], size: 16 };
test('secondary UV mask and opacity survive a static effect bake', () => {
 const result = bakeAtlas({ ...quad, uv: [0, 0, 0, 0, 0, 0, 0, 0], textures: [texture([255, 128, 64, 255]), texture([255, 255, 255, 0, 255, 255, 255, 255], 2)], opacity: .5 });
 assert.equal(result.pixels[(8 * 16 + 3) * 4 + 3], 0);
 assert.equal(result.pixels[(8 * 16 + 12) * 4 + 3], 128);
 assert.equal(result.pixels[(8 * 16 + 12) * 4], 255);
});
test('Mod2x combines RGB and alpha, while transformed UV masks use the sampled frame', () => {
 const result = bakeAtlas({ ...quad, textures: [texture([128, 128, 128, 128]), texture([128, 128, 128, 128])], factor: 2 });
 assert.ok(Math.abs(result.pixels[(8 * 16 + 8) * 4] - 129) <= 1);
 assert.ok(Math.abs(result.pixels[(8 * 16 + 8) * 4 + 3] - 129) <= 1);
 const translated = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 1];
 const shifted = bakeAtlas({ ...quad, textures: [texture([255, 255, 255, 255]), texture([255, 255, 255, 0, 255, 255, 255, 255], 2)], matrices: [null, translated] });
 assert.equal(shifted.pixels[(8 * 16 + 3) * 4 + 3], 255);
 assert.equal(bakeAtlas({ ...quad, uv2: new Array(8).fill(0), textures: [] }), null);
});
test('overlapping and repeated effect faces retain last-face-wins colors', () => {
 const result = bakeAtlas({
  triangles: [0,1,2, 3,4,5, 0,1,2], size: 16,
  uv: [0,0,0,0,0,0, 1,0,1,0,1,0],
  uv2: [0,0,1,0,0,1, 0,0,1,0,0,1],
  textures: [texture([255,0,0,255, 0,0,255,255],2), texture([255,255,255,255])],
 });
 assert.deepEqual(Array.from(result.pixels.slice((4*16+4)*4,(4*16+4)*4+4)), [255,0,0,255]);
});

test('racial rune keeps a fixed shape while its first atlas sample scrolls', () => {
 const atlas = texture([255,255,255,255, 240,180,40,255, 0,0,0,0, 0,0,0,0], 4);
 const scroll = [1,0,0,0, 0,1,0,0, 0,0,1,0, .25,0,0,1];
 const result = bakeAtlas({ ...quad, uv: [.125,0,.125,0,.125,1,.125,1],
  textures: [atlas, atlas], matrices: [scroll, null] });
 assert.deepEqual(Array.from(result.pixels.slice((8*16+3)*4,(8*16+3)*4+4)), [240,180,40,255]);
 assert.equal(result.pixels[(8*16+12)*4+3], 0);
});
