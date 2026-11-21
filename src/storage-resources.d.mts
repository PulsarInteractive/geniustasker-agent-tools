import type { ZodType } from 'zod/v4';

export const scopedStorageTools: ReadonlyMap<
  string,
  {
    tool: {
      name: string;
      route: string;
      description: string;
      method?: string;
      write: boolean;
      destructive: boolean;
      idempotent: boolean;
    };
    schema: ZodType;
  }
>;
export const scopedStorageCommands: Readonly<Record<string, string>>;
export function scopedStorageToolFor(command: string, input: unknown): string;
export function scopedStorageRequest(
  name: string,
  input: unknown,
  send: (method: string, route: string, params: Record<string, unknown>) => Promise<unknown>,
): Promise<Record<string, unknown>>;
export function clientStorageRequest(
  client: {
    get(route: string, params: Record<string, unknown>): Promise<unknown>;
    accessToken(): Promise<string>;
    transport: { request(route: string, options: Record<string, unknown>): Promise<unknown> };
  },
  name: string,
  input: unknown,
): Promise<Record<string, unknown>>;
