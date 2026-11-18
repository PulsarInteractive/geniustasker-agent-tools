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

/** Product feedback uses dedicated tools outside the generic command registry. */
export function withFeedbackDiscovery(capabilities) {
  return {
    ...capabilities,
    feedback: {
      types: ['BugReport', 'FeatureRequest'],
      capabilitiesTool: 'tasker_feedback_capabilities',
      workflowTopic: 'feedback',
      prepareTool: 'tasker_feedback_prepare',
      submitTool: 'tasker_feedback_submit',
      guidance:
        'Check the dedicated capabilities tool for current permissions. If it is missing in ChatGPT, refresh tools in the plugin settings and open a new chat.',
    },
  };
}
