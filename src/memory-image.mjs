import * as z from 'zod/v4';
import tools from '../remote/tool-catalog.json' with { type: 'json' };
import { fail } from './errors.mjs';

export const memoryImageTool = tools.find((tool) => tool.name === 'tasker_memory_view_image');
export const memoryCatalogTool = tools.find((tool) => tool.name === 'tasker_memory_catalog');
export const memoryCatalogSchema = z.fromJSONSchema(memoryCatalogTool.inputSchema);
export const memoryImageSchema = z.fromJSONSchema(memoryImageTool.inputSchema);
export const memoryPreviewBytes = 512 * 1024;
const invalid = () =>
  fail('invalid_response', 'The service returned an invalid image preview.', { status: 502 });

function readDimensions(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 24 || bytes.length > memoryPreviewBytes) {
    invalid();
  }
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = (at) => String.fromCharCode(...bytes.subarray(at, at + 4));
  if (text(0) !== 'RIFF' || text(8) !== 'WEBP' || data.getUint32(4, true) !== bytes.length - 8) {
    invalid();
  }
  let dimensions;
  for (let pos = 12; pos < bytes.length;) {
    if (bytes.length - pos < 8) {
      invalid();
    }
    const kind = text(pos),
      size = data.getUint32(pos + 4, true),
      at = pos + 8;
    if (size + (size % 2) > bytes.length - at || kind === 'ANIM' || kind === 'ANMF') {
      invalid();
    }
    if (kind === 'VP8 ' || kind === 'VP8L') {
      if (dimensions) {
        invalid();
      }
      if (kind === 'VP8 ') {
        if (size < 10 || bytes[at + 3] !== 0x9d || bytes[at + 4] !== 1 || bytes[at + 5] !== 0x2a) {
          invalid();
        }
        dimensions = {
          width: data.getUint16(at + 6, true) & 0x3fff,
          height: data.getUint16(at + 8, true) & 0x3fff,
        };
      } else {
        if (size < 5 || bytes[at] !== 0x2f) {
          invalid();
        }
        const header = data.getUint32(at + 1, true);
        dimensions = { width: (header & 0x3fff) + 1, height: ((header >>> 14) & 0x3fff) + 1 };
      }
    }
    pos = at + size + (size % 2);
  }
  if (
    !dimensions ||
    dimensions.width < 1 ||
    dimensions.height < 1 ||
    Math.max(dimensions.width, dimensions.height) > 1024
  ) {
    invalid();
  }
  return dimensions;
}

export async function readMemoryImage(client, input) {
  const parsed = memoryImageSchema.safeParse(input);
  if (!parsed.success) {
    fail('invalid_arguments', 'Select one image block in an authorized Memory page.');
  }
  const { scope, pageId, blockId, revision } = parsed.data;
  const query = {
    scope,
    pageId,
    mode: 'blocks',
    blockIds: blockId,
    maxBytes: 8192,
    ...(revision ? { revision } : {}),
  };
  const page = await client.get('memory/sections', query);
  if (
    page?.scope !== scope ||
    page.id !== pageId ||
    !/^(0|[1-9][0-9]{0,15})$/.test(page.revision) ||
    (revision && page.revision !== revision) ||
    !page.epoch ||
    !page.accessRevision ||
    !Array.isArray(page.items)
  ) {
    invalid();
  }
  const [block] = page.items;
  if (
    page.items.length !== 1 ||
    block?.id !== blockId ||
    block.kind !== 'image' ||
    typeof block.assetId !== 'string' ||
    !/^[a-zA-Z0-9_-]{1,128}$/.test(block.assetId)
  ) {
    fail('memory_image_unavailable', 'This page block has no available image.', { status: 404 });
  }
  const id = block.assetId;
  const assets = await client.get('resources', { scope, collection: 'assets', id });
  const asset = assets?.items?.[0];
  if (
    assets?.scope !== scope ||
    assets.collection !== 'assets' ||
    assets.items?.length !== 1 ||
    asset?.id !== id ||
    !asset.data ||
    assets.omittedIds?.length ||
    (assets.epoch && assets.epoch !== page.epoch)
  ) {
    fail('memory_image_unavailable', 'The selected image is not currently available.', {
      status: 404,
    });
  }
  const original = asset.data;
  const owner = /^\/api\/v2\/media\/([a-zA-Z0-9_-]{1,128})\/([a-zA-Z0-9_-]{1,128})$/.exec(
    original.url ?? '',
  );
  if (
    !owner ||
    owner[2] !== id ||
    !['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'].includes(
      original.contentType,
    ) ||
    !Number.isSafeInteger(original.sizeBytes) ||
    original.sizeBytes < 1
  ) {
    invalid();
  }
  const bytes = await client.getPreview({ scope, ownerId: owner[1], id, view: 'preview' });
  const dimensions = readDimensions(bytes);
  const current = await client.get('memory/sections', {
    ...query,
    epoch: page.epoch,
    revision: page.revision,
    knownRevision: page.revision,
  });
  if (
    current?.scope !== scope ||
    current.id !== pageId ||
    current.epoch !== page.epoch ||
    current.revision !== page.revision ||
    current.accessRevision !== page.accessRevision ||
    current.notModified !== true
  ) {
    fail(
      'memory_read_context_changed',
      'The page changed while the preview was loading. Reread the image selection.',
      { status: 409 },
    );
  }
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return {
    type: 'image',
    mimeType: 'image/webp',
    data: btoa(binary),
    metadata: {
      scope,
      pageId,
      blockId,
      revision: page.revision,
      assetId: id,
      assetRevision: asset.revision,
      ...dimensions,
      bytes: bytes.length,
      originalBytes: original.sizeBytes,
      originalContentType: original.contentType,
    },
  };
}
