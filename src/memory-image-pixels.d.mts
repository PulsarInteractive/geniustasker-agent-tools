export const memoryPreviewBytes: number;
export type MemoryImageSelector = {
  scope: string;
  pageId: string;
  blockId: string;
  revision?: string;
  atRevision?: string;
};
export function readMemoryImagePixels(
  client: {
    get(route: string, query: Record<string, string | number>): Promise<unknown>;
    getHistoricalPreview?(
      query: Record<string, string>,
    ): Promise<{ bytes: Uint8Array; selection: string | null }>;
    getPreview(query: Record<string, string>): Promise<Uint8Array>;
  },
  input: MemoryImageSelector,
): Promise<{ bytes: Uint8Array; metadata: Record<string, unknown> }>;
