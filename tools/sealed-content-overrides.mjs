// Reviewed, sourced supplements to MTGJSON sealed-product contents.
//
// MTGJSON remains the canonical structural baseline. This overlay is deliberately
// small and product-keyed: it only fills contents that upstream leaves as prose.
// Every claim is reusable (cases apply a multiplier), dated, and carries its
// evidence strength so a future upstream improvement can replace it cleanly.

const fixedKey = (card) => `${card.set.toUpperCase()}|${card.cn}|${card.finish ?? (card.foil ? "foil" : "nonfoil")}`;

export function applySealedContentOverrides(document, overlay) {
  const appliedClaims = new Set();
  for (const product of document.products) {
    const specification = overlay.products?.[`${document.set}/${product.key}`];
    if (!specification) continue;
    const fixed = new Map((product.fixed ?? []).map((card) => [fixedKey(card), { ...card }]));
    const evidence = [...(product.evidence ?? [])];
    const unresolvedContents = [...(product.unresolvedContents ?? [])];
    const claimIds = specification.claims ?? [specification.claim];
    for (const claimId of claimIds) {
      const claim = overlay.claims?.[claimId];
      if (!claim) throw new Error(`Unknown sealed-content claim: ${claimId}`);
      const multiplier = specification.multiplier ?? 1;
      const remove = new Set(claim.removeOther ?? []);
      product.other = (product.other ?? []).filter((text) => !remove.has(text));
      for (const card of claim.fixed ?? []) {
        const normalized = {
          set: card.set.toUpperCase(), cn: String(card.cn), n: card.n * multiplier,
          foil: card.foil ?? card.finish !== "nonfoil",
          ...(card.finish ? { finish: card.finish } : {}),
        };
        const key = fixedKey(normalized);
        const existing = fixed.get(key);
        if (existing) existing.n += normalized.n;
        else fixed.set(key, normalized);
      }
      for (const unresolved of claim.unresolved ?? []) {
        unresolvedContents.push({ ...unresolved, n: unresolved.n * multiplier, claim: claimId });
      }
      evidence.push({
        claim: claimId,
        evidenceLevel: claim.evidenceLevel,
        sources: claim.sources,
        retrievedAt: claim.retrievedAt,
        note: claim.note,
      });
      appliedClaims.add(claimId);
    }
    if (!product.other?.length) delete product.other;
    product.fixed = [...fixed.values()];
    if (unresolvedContents.length) product.unresolvedContents = unresolvedContents;
    product.evidence = evidence;
  }
  if (appliedClaims.size) {
    document.src.researchOverlay = {
      version: overlay.version,
      verifiedAt: overlay.verifiedAt,
      claims: [...appliedClaims].sort(),
    };
  }
  return document;
}
