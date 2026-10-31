// Base-clothing texture targets are independent: 13 = upper, 14 = lower.
module.exports = function includeBaseClothing(target, mode, equipment = {}, modifiers = {}, displayForItem) {
 if (target !== 13 && target !== 14) return true;
 if (mode === false) return false;
 if (mode === true) return true;
 const slot = target === 13 ? 5 : 7;
 // Hidden transmogs have no display. Keep coverage for hidden/empty slots.
 const item = equipment?.[slot];
 return !item || !displayForItem(item, modifiers?.[slot]);
};
