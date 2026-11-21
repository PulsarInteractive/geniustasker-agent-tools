export const memoryPreviewBytes: number;
export type MemoryImageSelector = {
  scope: string;
  pageId: string;
  blockId: string;
  revision?: string;
};
export function readMemoryImagePixels(
  client: {
    get(route: string, query: Record<string, string | number>): Promise<unknown>;
    getPreview(query: Record<string, string>): Promise<Uint8Array>;
  },
  input: MemoryImageSelector,
): Promise<{ bytes: Uint8Array; metadata: Record<string, unknown> }>;
