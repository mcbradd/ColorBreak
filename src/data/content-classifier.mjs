// This module is intentionally plain ESM: both the browser TypeScript code and
// the Node coverage tool need the exact same evidence rule.

/**
 * @typedef {"cardlike-unresolved" | "approved-accessory" | "not-cardlike"} ContentClassification
 */

const CARDLIKE_PROSE = /\b(cards?|lands?)\b/i;

// These exceptions are deliberately phrases, not broad product words. Each is
// an accessory form documented in the sealed-content evidence ledger; do not
// add a generic "box", "display", or "helper" escape hatch here.
const APPROVED_ACCESSORY_PHRASES = [
  /\b(?:first game )?walk through cards?\b/i,
  /\bart only scene cards?\b/i,
  /\b(?:mtg )?arena code cards?\b/i,
  /\b(?:rules )?reference cards?\b/i,
  /\bdouble sided reference cards?\b/i,
  /\bcard storage box\b/i,
  /\bcard box\b/i,
  /\b(?:oversized|double sided foil) dungeon cards?\b/i,
  /\bmax speed helper cards?\b/i,
];

function normalized(text) {
  return text.toLowerCase().replace(/[\s-]+/g, " ").trim();
}

/**
 * Classify unstructured sealed-product prose without relying on product data.
 * @param {string} text
 * @returns {ContentClassification}
 */
export function classifyContentProse(text) {
  const value = normalized(text);
  if (!CARDLIKE_PROSE.test(value)) return "not-cardlike";
  return APPROVED_ACCESSORY_PHRASES.some((phrase) => phrase.test(value))
    ? "approved-accessory"
    : "cardlike-unresolved";
}
