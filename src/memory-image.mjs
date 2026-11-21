import * as z from 'zod/v4';
import tools from '../remote/tool-catalog.json' with { type: 'json' };
import { fail } from './errors.mjs';
import { readMemoryImagePixels } from './memory-image-pixels.mjs';

export const memoryImageTool = tools.find((tool) => tool.name === 'tasker_memory_view_image');
export const memoryCatalogTool = tools.find((tool) => tool.name === 'tasker_memory_catalog');
export const memoryCatalogSchema = z.fromJSONSchema(memoryCatalogTool.inputSchema);
export const memoryImageSchema = z.fromJSONSchema(memoryImageTool.inputSchema);

export async function readMemoryImage(client, input) {
  const parsed = memoryImageSchema.safeParse(input);
  if (!parsed.success) {
    fail('invalid_arguments', 'Select one image block in an authorized Memory page.');
  }
  const { bytes, metadata } = await readMemoryImagePixels(client, parsed.data);
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return { type: 'image', mimeType: 'image/webp', data: btoa(binary), metadata };
}
