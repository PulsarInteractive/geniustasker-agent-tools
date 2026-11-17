import * as z from 'zod/v4';
import contract from './task-availability-contract.mjs';

export const taskAvailabilitySchema = z.fromJSONSchema(contract);

/** Validate only the optional projection. Its head belongs to the current task
 * module, not necessarily the page's historical checkpoint or the row revision.
 * Legacy absence is retained; it must never become an invented unlocked state. */
export function validTaskAvailabilityPage(page, collection, taskState) {
  if (!Array.isArray(page?.items)) {
    return true;
  }
  return page.items.every((item) => {
    if (!item || !Object.hasOwn(item, 'taskAvailability')) {
      return true;
    }
    return (
      collection === 'tasks' &&
      taskState === 'v1' &&
      item.kind !== 'remove' &&
      taskAvailabilitySchema.safeParse(item.taskAvailability).success &&
      item.taskAvailability.source.epoch === page.epoch
    );
  });
}
