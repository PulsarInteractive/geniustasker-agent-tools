import { open } from 'node:fs/promises';
import { constants } from 'node:fs';
import { feedbackReadSchema } from './feedback.mjs';
import { fail } from './errors.mjs';
import { basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import { readFeedbackImageFile } from './feedback-image.mjs';
import { validateFeedbackUpload } from './feedback.mjs';
import { CommandJournal } from './commands.mjs';

/** Reuse the bounded static-image reader; the server independently validates
 * and compresses every upload, before storing it. */
export async function prepareFeedbackImage({ draftId, expectedEpoch, file }) {
  const image = { ...(await readFeedbackImageFile(file)) };
  delete image.bytes;
  return validateFeedbackUpload({
    id: randomUUID(),
    draftId,
    expectedEpoch,
    issuedAt: Date.now(),
    fileName: basename(file),
    ...image,
  });
}
export async function uploadFeedbackImage(client, { operationId, file }) {
  const journal = new CommandJournal(client);
  const confirmed = await journal.confirmedFeedbackMediaUpload(operationId);
  if (confirmed) {
    return confirmed;
  }
  const image = await readFeedbackImageFile(file);
  return journal.uploadFeedbackMediaBytes(operationId, image.bytes, image.sha256);
}

/** Download only an explicit feedback image to a new local file. Never overwrite. */
export async function downloadFeedbackImage(client, { id, file }) {
  if (!feedbackReadSchema.safeParse({ id }).success || typeof file !== 'string' || !file) {
    fail(
      'invalid_arguments',
      'An exact feedback image ID and a new local output file are required.',
    );
  }
  const bytes = await client.transport.request(`/api/agents/v1/feedback/media/${id}/content`, {
    token: await client.accessToken(),
    binary: true,
  });
  if (!bytes.length) {
    fail('invalid_response', 'The feedback screenshot was empty.');
  }
  const handle = await open(
    file,
    constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
    0o600,
  );
  try {
    await handle.writeFile(bytes);
  } finally {
    await handle.close();
  }
  return { id, file, bytes: bytes.length };
}
