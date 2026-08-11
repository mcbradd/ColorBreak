// MTGJSON booster sheets reference UUIDs from every set listed in
// `sourceSetCodes`. Resolve those declared sources before trying release-window
// heuristics or a hand-maintained override.
export function sourceSetCandidates(data, refs) {
  const own = String(data.code ?? "").toUpperCase();
  const output = [];
  for (const ref of refs) {
    const config = data.booster?.[ref.booster];
    for (const code of config?.sourceSetCodes ?? []) {
      const normalized = String(code).toUpperCase();
      if (normalized && normalized !== own && !output.includes(normalized)) output.push(normalized);
    }
  }
  return output;
}
