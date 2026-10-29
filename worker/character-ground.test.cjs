const test = require('node:test');
const assert = require('node:assert/strict');
const ground = require('../src/js/3D/character-ground');
const { get_attachment_ids_for_slot, ATTACHMENT_ID } = require('../src/js/wow/EquipmentSlots');
test('ground uses visible body and boot vertices, excluding weapons and unused vertices', () => {
 const body = [0,0.1,0, 0,-10,0, 0,2,0];
 const meshes = [{triangles:[0,2]}];
 assert.equal(ground(body,meshes,[{slotID:16,vertices:[0,-2,0],meshes:[{triangles:[0]}] }])?.groundY,0.1);
 assert.equal(ground(body,meshes,[{slotID:8,vertices:[0,0.02,0],meshes:[{triangles:[0]}] }])?.groundY,0.02);
 assert.equal(ground([],[],[]),null);
});
test('belt buckle is a rigid waist attachment', () => {
 assert.deepEqual(get_attachment_ids_for_slot(6),[ATTACHMENT_ID.BELT_BUCKLE]);
 assert.equal(ATTACHMENT_ID.BELT_BUCKLE,53);
});

test('stance center ignores raised hands, weapons, and uneven mesh density', () => {
 const body = [-2,0,-1, 4,0,3, 20,10,8];
 const meshes = [{triangles:[0,0,0,1,2]}];
 const support = ground(body,meshes,[{slotID:16,vertices:[100,-10,100],meshes:[{triangles:[0]}]}]);
 assert.deepEqual(support,{groundY:0,centerX:1,centerZ:1});
});
test('sitting support includes visible boots and uses the low contact region', () => {
 const body = [2,1,-2, 4,1,0, 3,5,-1];
 assert.deepEqual(ground(body,[{triangles:[0,1,2]}],[{slotID:8,vertices:[6,1,2],meshes:[{triangles:[0]}]}]),{groundY:1,centerX:4,centerZ:0});
});
