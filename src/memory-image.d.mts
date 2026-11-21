export interface MemoryMcpImage {
  type: 'image';
  mimeType: 'image/webp';
  data: string;
  metadata: Record<string, unknown>;
}
export function readMemoryImage(
  client: {
    get(route: string, query: Record<string, string | number>): Promise<unknown>;
    getPreview(query: Record<string, string>): Promise<Uint8Array>;
  },
  input: unknown,
): Promise<MemoryMcpImage>;
export const memoryPreviewBytes: number;
