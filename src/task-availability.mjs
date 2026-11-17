import * as z from 'zod/v4';
import contract from './task-availability-contract.mjs';
import legacyContract from './task-state-legacy-contract.mjs';

export const taskAvailabilityV1Schema = z.fromJSONSchema(legacyContract);
export const taskAvailabilityV2Schema = z.fromJSONSchema(contract);
export const taskAvailabilitySchema = z.union([taskAvailabilityV1Schema, taskAvailabilityV2Schema]);

/** Validate only the optional projection. Its head belongs to the current task
 * module, not necessarily the page's historical checkpoint or the row revision.
 * Legacy absence is retained; it must never become an invented unlocked state. */
export function validTaskAvailabilityPage(page, collection, taskState) {
  if (!Array.isArray(page?.items)) {
    return true;
  }
  const schema =
    taskState === 'v2'
      ? taskAvailabilityV2Schema
      : taskState === 'v1'
        ? taskAvailabilityV1Schema
        : null;
  return page.items.every((item) => {
    if (!item || !Object.hasOwn(item, 'taskAvailability')) {
      return true;
    }
    return (
      collection === 'tasks' &&
      schema !== null &&
      item.kind !== 'remove' &&
      !(taskState === 'v1' && item.data?.status === 'Paused') &&
      schema.safeParse(item.taskAvailability).success &&
      item.taskAvailability.source.epoch === page.epoch
    );
  });
}
