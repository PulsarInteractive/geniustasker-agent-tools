export function readMemoryPages(
  client: { get(route: string, query: Record<string, string | number>): Promise<unknown> },
  input: unknown,
): Promise<Record<string, unknown>>;
