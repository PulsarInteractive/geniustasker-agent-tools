import { open } from 'node:fs/promises';
import { constants } from 'node:fs';
import { createHash } from 'node:crypto';
import { AgentError, fail } from './errors.mjs';
const maxFeedbackUploadBytes = 4_000_000;

/** Header inspection prepares exact metadata; the server independently checks
 * the complete static container and rejects malformed or animated images. */
function imageMetadata(bytes) {
  let width, height, contentType;
  if (
    bytes.length >= 24 &&
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
    bytes.toString('ascii', 12, 16) === 'IHDR'
  ) {
    width = bytes.readUInt32BE(16);
    height = bytes.readUInt32BE(20);
    contentType = 'image/png';
  } else if (
    bytes.length >= 12 &&
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.toString('ascii', 8, 12) === 'WEBP'
  ) {
    const type = bytes.toString('ascii', 12, 16);
    if (type === 'VP8X' && bytes.length >= 30) {
      if (bytes[20] & 2) {
        fail('invalid_arguments', 'Feedback screenshots must be static images.');
      }
      width = bytes.readUIntLE(24, 3) + 1;
      height = bytes.readUIntLE(27, 3) + 1;
    } else if (
      type === 'VP8 ' &&
      bytes.length >= 30 &&
      bytes.subarray(23, 26).equals(Buffer.from([157, 1, 42]))
    ) {
      width = bytes.readUInt16LE(26) & 16383;
      height = bytes.readUInt16LE(28) & 16383;
    } else if (type === 'VP8L' && bytes.length >= 25 && bytes[20] === 47) {
      width = 1 + (bytes.readUInt32LE(21) & 16383);
      height = 1 + ((bytes.readUInt32LE(21) >>> 14) & 16383);
    }
    contentType = 'image/webp';
  } else if (bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216) {
    contentType = 'image/jpeg';
    let at = 2;
    while (at + 4 <= bytes.length) {
      if (bytes[at++] !== 255) {
        break;
      }
      while (bytes[at] === 255) {
        at++;
      }
      const marker = bytes[at++];
      if ([216, 217, 218].includes(marker)) {
        break;
      }
      const length = bytes.readUInt16BE(at);
      if (length < 2 || at + length > bytes.length) {
        break;
      }
      if (
        [192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker) &&
        length >= 7
      ) {
        height = bytes.readUInt16BE(at + 3);
        width = bytes.readUInt16BE(at + 5);
        break;
      }
      at += length;
    }
  }
  if (!width || !height || width > 4096 || height > 4096) {
    fail(
      'invalid_arguments',
      'Use one static PNG, JPEG or WebP image up to 4096 pixels per dimension.',
    );
  }
  return { width, height, contentType };
}
export async function readFeedbackImageFile(path) {
  if (typeof path !== 'string' || !path) {
    fail('invalid_arguments', 'Supply one local image file path.');
  }
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size < 1) {
      fail('invalid_arguments', 'Use one non-empty regular image file.');
    }
    if (stat.size > maxFeedbackUploadBytes) {
      fail('feedback_media_too_large', 'Use a screenshot no larger than 4,000,000 bytes.', {
        status: 413,
      });
    }
    const buffer = Buffer.alloc(stat.size + 1);
    let length = 0;
    while (length < buffer.length) {
      const read = await handle.read(buffer, length, buffer.length - length, null);
      if (read.bytesRead === 0) {
        break;
      }
      length += read.bytesRead;
    }
    if (length !== stat.size) {
      fail('invalid_arguments', 'The image changed while it was being read. Prepare it again.');
    }
    const bytes = buffer.subarray(0, length);
    return {
      bytes,
      ...imageMetadata(bytes),
      size: length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    };
  } catch (error) {
    if (error instanceof AgentError) {
      throw error;
    }
    fail('invalid_arguments', 'Could not read one regular image file.');
  } finally {
    await handle?.close();
  }
}
