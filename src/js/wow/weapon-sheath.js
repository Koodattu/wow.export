const { ATTACHMENT_ID: A } = require('./EquipmentSlots');
// Retail Item.SheatheType (0..4), not the older network protocol's 0..7 enum.
// See WoW Model Viewer's database.cpp ItemRecord mapping and WoWItem.cpp attachment selection.
module.exports = function sheathAttachment(slot, sheathType) {
	if (slot !== 16 && slot !== 17) return null;
	const main = slot === 16;
	switch (sheathType) {
		case 1: return main ? A.SHEATH_MAIN_HAND : A.SHEATH_OFF_HAND;
		case 2: return main ? A.RIGHT_BACK : A.LEFT_BACK;
		case 3: return main ? A.RIGHT_HIP_SHEATH : A.LEFT_HIP_SHEATH;
		case 4: return A.SHEATH_SHIELD;
		default: return null; // Non-stowable offhands disappear when sheathed.
	}
};
