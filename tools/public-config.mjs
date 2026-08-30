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
}

export { ALLOWED_ORIGINS };
