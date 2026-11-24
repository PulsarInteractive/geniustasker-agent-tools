import test from 'node:test';
import assert from 'node:assert/strict';
import { readTicketImage } from '../src/memory-image.mjs';

const select = { scope: 'project:atlas', taskId: 'chapter', assetId: 'diagram' };
const preview = 'UklGRh4AAABXRUJQVlA4TBEAAAAvA8ACAAdQjmb3pv+BiOh/AAA=';

test('a ticket image is returned as bounded pixels using the selected ticket and current session', async () => {
  const client = {
    getPreview: async (query) => {
      assert.deepEqual(query, {
        scope: select.scope,
        taskId: select.taskId,
        id: select.assetId,
        view: 'preview',
      });
      return Buffer.from(preview, 'base64');
    },
  };
  const image = await readTicketImage(client, select);
  assert.deepEqual(image, {
    type: 'image',
    mimeType: 'image/webp',
    data: preview,
    metadata: { ...select, width: 4, height: 12 },
  });
  await assert.rejects(readTicketImage(client, { ...select, scope: 'memory:atlas' }), {
    code: 'invalid_arguments',
  });
  await assert.rejects(readTicketImage({ getPreview: async () => Buffer.from('empty') }, select), {
    code: 'invalid_response',
  });
  await assert.rejects(
    readTicketImage(
      {
        getPreview: async () => {
          throw new Error('revoked');
        },
      },
      select,
    ),
    /revoked/,
  );
});
