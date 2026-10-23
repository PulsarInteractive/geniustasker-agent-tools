import * as z from 'zod/v4';
import guides from '../remote/workflows.json' with { type: 'json' };

/** Reviewed static guidance, shared with the hosted connector. No account data. */
export const workflowSchema = z.object({ topic: z.enum(Object.keys(guides.topics)) }).strict();
export function workflow(input) {
  const { topic } = workflowSchema.parse(input);
  return { version: guides.version, topic, ...guides.topics[topic] };
}
