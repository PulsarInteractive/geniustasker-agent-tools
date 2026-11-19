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

/** Discovery only describes the connected profile. Effective project membership,
 * contribution mode and per-ticket authorization are checked by the service. */
export function withFeedbackDiscovery(capabilities) {
  return {
    ...capabilities,
    firstMission: {
      workflowTopic: 'first-mission',
      canListProjects: capabilities?.permissions?.includes('projects:read') === true,
      canReadTickets: capabilities?.permissions?.includes('tasks:read') === true,
      runCommands: (Array.isArray(capabilities?.commands) ? capabilities.commands : [])
        .map((command) => command.kind)
        .filter((kind) =>
          ['run.claim', 'run.patch', 'run.pause', 'run.resume', 'run.finish'].includes(kind),
        ),
      projectCheck:
        'Read the selected project to confirm agent contributions and current membership.',
    },
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
