export type ContentClassification = "cardlike-unresolved" | "approved-accessory" | "not-cardlike";

/** Classify unstructured sealed-product prose without relying on product data. */
export function classifyContentProse(text: string): ContentClassification;
