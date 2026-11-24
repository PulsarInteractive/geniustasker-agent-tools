import * as z from 'zod/v4';
import tools from '../remote/tool-catalog.json' with { type: 'json' };
import { fail } from './errors.mjs';
import { readMemoryImagePixels } from './memory-image-pixels.mjs';

export const memoryImageTool = tools.find((tool) => tool.name === 'tasker_memory_view_image');
export const memoryCatalogTool = tools.find((tool) => tool.name === 'tasker_memory_catalog');
export const designDiscussionTool = tools.find(
  (tool) => tool.name === 'tasker_memory_design_discussion',
);
export const designDiscussionSchema = z.fromJSONSchema(designDiscussionTool.inputSchema);
export const memoryCatalogSchema = z.fromJSONSchema(memoryCatalogTool.inputSchema);
export const memoryImageSchema = z.fromJSONSchema(memoryImageTool.inputSchema);

/** Scope, publication and revision bind the catalog result to a subsequent page read. */
export async function readMemoryCatalog(client, input) {
  const query = memoryCatalogSchema.safeParse(input);
  if (!query.success) {
    fail('invalid_arguments', 'Choose one space and its supported catalog filters.');
  }
  const selected = query.data;
  const result = await client.get('memory/catalog', selected);
  if (
    result?.scope !== selected.scope ||
    !Array.isArray(result.items) ||
    result.items.length > 16 ||
    result.items.some(
      (item) =>
        !item ||
        typeof item.id !== 'string' ||
        !/^[a-zA-Z0-9_-]{1,128}$/.test(item.id) ||
        typeof item.revision !== 'string' ||
        !/^(0|[1-9][0-9]{0,31})$/.test(item.revision) ||
        (selected.status !== undefined && item.guide?.status !== selected.status) ||
        (selected.track !== undefined && item.design?.track !== selected.track) ||
        (selected.parentId !== undefined && item.parentId !== selected.parentId),
    ) ||
    new Set(result.items.map((item) => item.id)).size !== result.items.length ||
    (result.nextCursor !== null &&
      (typeof result.nextCursor !== 'string' ||
        !result.nextCursor.length ||
        result.nextCursor.length > 200 ||
        result.nextCursor === selected.cursor))
  ) {
    fail('invalid_response', 'The catalog returned an inconsistent scope, page or continuation.', {
      status: 502,
    });
  }
  return result;
}

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
