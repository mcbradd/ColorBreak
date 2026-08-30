export function buildReleaseManifest(options?: { outputDir?: string; root?: string; buildTimestamp?: string }): Promise<{ id: string; dataFiles: unknown[] }>;
