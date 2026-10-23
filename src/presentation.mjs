/** Hide operational limit tables from routine MCP identity/capability results;
 * the server remains responsible for enforcement and actionable errors. */
export function agentPresentation(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }
  const { rateLimits, ...result } = value;
  if (rateLimits?.tier) {
    result.plan = { Free: 'Free', Starter: 'Starter', Pro: 'Pro' }[rateLimits.tier] ?? 'Unknown';
  }
  return result;
}
