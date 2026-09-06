import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createServer } from "vite";

// Use the actual application resolver, so the audit cannot develop a second policy.
const server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: "custom" });
try {
  const { resolveCollation, COLLATION_RULES, COLLATION_VERSION } = await server.ssrLoadModule("/src/data/collation-policy.ts");
  const documents = Object.fromEntries(readdirSync("data/sealed").filter((name) => name.endsWith(".json") && name !== "index.json")
    .map((name) => { const document = JSON.parse(readFileSync(`data/sealed/${name}`, "utf8")); return [document.set, document]; }));
  // Exercise physical constraints for every SKU, including fixed theme multiplicities.
  globalThis.fetch = async (input) => {
    try { return new Response(readFileSync(String(input).replace(/^\.\//, ""))); }
    catch { return new Response("unavailable", { status: 404 }); }
  };
  const { loadPrices } = await server.ssrLoadModule("/src/data/scryfall.ts");
  const { outcomeModelForProduct } = await server.ssrLoadModule("/src/data/outcome-model.ts");
  const { simulateOutcomes } = await server.ssrLoadModule("/src/domain/simulation.ts");
  const priceIndex = JSON.parse(readFileSync("data/prices/index.json", "utf8"));
  const { cards } = await loadPrices({ sets: Object.keys(priceIndex.sets) });
  const corrections = JSON.parse(readFileSync("data/corrections.json", "utf8"));
  const products = {};
  const recipes = {};
  const matchedRules = new Set();
  for (const document of Object.values(documents).sort((a, b) => a.set.localeCompare(b.set))) for (const product of document.products) {
    const key = `${document.set}/${product.key}`;
    const outcome = await outcomeModelForProduct(document, product.key, 1, cards, 0, documents);
    assert.doesNotThrow(() => simulateOutcomes(outcome.model, { seed: key, sampleCount: 1, remaining: ["W", "U", "B", "R", "G", "M", "C", "L"] }), `${key}: invalid physical constraints`);
    const correction = corrections.products[key];
    const packs = { ...product.packs };
    for (const code of correction?.removePacks ?? []) delete packs[code];
    for (const [code, count] of Object.entries(correction?.addPacks ?? {})) packs[code] = (packs[code] ?? 0) + count;
    const components = [];
    for (const [code, count] of Object.entries(packs)) {
      const [set, booster] = code.includes(":") ? code.split(":") : [document.set, code];
      const raw = documents[set]?.boosters[booster];
      assert.ok(raw, `${key}: unresolved booster dependency ${set}/${booster}`);
      const match = resolveCollation(set, booster, raw, key);
      assert.deepEqual(match.conflicts, [], `${key}: source conflicts`);
      const evidence = match.evidence.map(({ rule, tier, source, fact }) => { if (rule) matchedRules.add(rule); return { ...(rule ? { rule } : {}), tier, source, fact }; });
      const digest = createHash("sha256").update(JSON.stringify({ recipe: match.recipe, evidence })).digest("hex");
      recipes[digest] = { booster: `${set}/${booster}`, sourceVersion: documents[set].src.mtgjsonDate, ...(documents[set].src.fixedSheetEvidence ? { fixedSheetEvidence: documents[set].src.fixedSheetEvidence } : {}), evidence };
      components.push({ booster: `${set}/${booster}`, count: count * (correction?.contentsMultiplier ?? 1), recipe: digest });
    }
    products[key] = { components, fixedCards: (product.fixed ?? []).reduce((sum, card) => sum + card.n, 0) * (correction?.contentsMultiplier ?? 1),
      ...(product.unresolvedContents?.length ? { unresolved: product.unresolvedContents.map((row) => row.label) } : {}) };
  }
  for (const rule of COLLATION_RULES) assert.ok(matchedRules.has(rule.id), `Unmatched rule: ${rule.id}`);
  const output = JSON.stringify({ version: COLLATION_VERSION, products, recipes }, null, 2) + "\n";
  if (process.argv.includes("--write")) writeFileSync("data/product-collation.json", output);
  else assert.deepEqual(JSON.parse(readFileSync("data/product-collation.json", "utf8")), JSON.parse(output), "Product collation mapping changed; review and regenerate with --write.");
  console.log(`PASS: ${Object.keys(products).length} individual products, ${Object.keys(recipes).length} recipes, ${matchedRules.size} matched sourced rules.`);
} finally { await server.close(); }
