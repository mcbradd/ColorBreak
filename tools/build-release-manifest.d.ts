export function buildReleaseManifest(options?: { outputDir?: string; root?: string; buildTimestamp?: string }): Promise<{ id: string; dataFiles: unknown[]; artifactFiles: unknown[]; releasePosture: "analysis-only" }>;
export function verifyReleaseArtifact(options?: { outputDir?: string }): Promise<unknown>;
export function scanReleaseAssets(outputDir: string): Promise<unknown[]>;
