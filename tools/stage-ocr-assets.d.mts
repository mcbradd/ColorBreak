export declare const OCR_PUBLIC_DIR: string;
export declare const OCR_ASSETS: Array<{ from: string; to: string; pkg: string }>;
export declare function stageOcrAssets(options?: { root?: string; outputDir?: string }): Promise<{
  purpose: string;
  servedFrom: string;
  packages: Record<string, { version: string; license: string }>;
  files: Array<{ path: string; package: string; bytes: number; sha256: string }>;
}>;
