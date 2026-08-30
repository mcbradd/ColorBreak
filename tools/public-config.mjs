const ALLOWED_ORIGINS = {
  VITE_ANALYTICS_ENDPOINT: ["https://plausible.io"],
  VITE_SUPPORT_URL: ["https://github.com", "https://ko-fi.com"],
  VITE_TCGPLAYER_AFFILIATE_URL: ["https://www.tcgplayer.com"],
};

export function validatePublicConfig(environment = process.env) {
  for (const [name, origins] of Object.entries(ALLOWED_ORIGINS)) {
    const value = environment[name]?.trim();
    if (!value) continue;
    let url;
    try { url = new URL(value); } catch { throw new Error(`${name} must be a valid HTTPS URL`); }
    if (url.protocol !== "https:" || url.username || url.password || !origins.includes(url.origin)) {
      throw new Error(`${name} must use an approved HTTPS origin without credentials`);
    }
  }
  const accessValues = ["VITE_ACCESS_INTEREST_URL", "VITE_ACCESS_INTEREST_PRIVACY_URL", "VITE_ACCESS_INTEREST_OWNER"];
  const configured = accessValues.filter((name) => environment[name]?.trim());
  if (configured.length && configured.length !== accessValues.length) {
    throw new Error("Access interest requires VITE_ACCESS_INTEREST_URL, VITE_ACCESS_INTEREST_PRIVACY_URL, and VITE_ACCESS_INTEREST_OWNER together");
  }
  for (const name of accessValues.slice(0, 2)) {
    const value = environment[name]?.trim();
    if (!value) continue;
    let url;
    try { url = new URL(value); } catch { throw new Error(`${name} must be a valid HTTPS URL`); }
    if (url.protocol !== "https:" || url.username || url.password) throw new Error(`${name} must be an HTTPS URL without credentials`);
  }
}

export { ALLOWED_ORIGINS };
