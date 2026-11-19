export function reviewProjectMemory(
  client: { get(route: string, query: Record<string, string | number>): Promise<unknown> },
  input: unknown,
): Promise<Record<string, unknown>>;
export function previewMemoryTemplate(input: unknown): Record<string, unknown>;
