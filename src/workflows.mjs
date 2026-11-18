import * as z from 'zod/v4';
import { fail } from './errors.mjs';
import guides from '../remote/workflows.json' with { type: 'json' };

/** Reviewed static guidance, shared with the hosted connector. No account data. */
export const workflowTopics = Object.keys(guides.topics);
export const workflowSchema = z.object({ topic: z.enum(workflowTopics) }).strict();
export function workflow(input) {
  const parsed = workflowSchema.safeParse(input);
  if (!parsed.success) {
    fail('invalid_arguments', 'Choose one supported workflow topic.', {
      remediation: 'Run geniustasker workflow show --help to list the available topics.',
    });
  }
  const { topic } = parsed.data;
  return { version: guides.version, topic, ...guides.topics[topic] };
}
