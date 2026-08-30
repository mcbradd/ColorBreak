export type AccessInterest = Readonly<{
  url: string;
  privacyUrl: string;
  owner: string;
}>;

export function accessInterestFrom(values: Record<string, string | undefined>): AccessInterest | undefined {
  const url = values.VITE_ACCESS_INTEREST_URL?.trim();
  const privacyUrl = values.VITE_ACCESS_INTEREST_PRIVACY_URL?.trim();
  const owner = values.VITE_ACCESS_INTEREST_OWNER?.trim();
  if (!url || !privacyUrl || !owner) return undefined;
  return { url, privacyUrl, owner };
}

export const runtimeAccessInterest = accessInterestFrom(import.meta.env);
