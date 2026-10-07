/* The piece choices and their text stand-ins. No three.js here, so menus can use it without loading the 3D code. */

/** all piece choices, in the order shown when picking a piece */
export const PIECES = [
  '🚗', '🎩', '🐶', '🐱', '🚀', '🚢', '🎸', '🦉', '🐢', '🌵', '⚽', '🍕',
  '👑', '🦄', '🏍️', 'iron', 'boot', 'duck', 'thimble', 'barrow', 'horse', 'sack', 'cannon',
];
// (the octopus 🐙 is no longer offered, but games saved with it still show it)
/** text stand-in where a picture can't be shown (plain text, devices without 3D) */
export const PIECE_TEXT: Record<string, string> = {
  iron: '♨️', boot: '👢', duck: '🦆', thimble: '🧵', barrow: '🛒', horse: '🐎', sack: '💰', cannon: '💥', '⛵': '🚢', '🛵': '🏍️',
};
export const pieceText = (id: string) => PIECE_TEXT[id] ?? id;
