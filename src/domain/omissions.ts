import type { Omission } from "./types";

export function deduplicateOmissions(omissions: Omission[]): Omission[] {
  const seen = new Set<string>();
  return omissions.filter((omission) => {
    const key = omission.dedupeKey ?? `${omission.code}\u0000${omission.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
