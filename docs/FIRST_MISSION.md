# Your first agent mission

Start from a real ticket with one observable result. For example, ask an agent to verify that the install command in a project's README works in an empty directory. A ticket link or a known project binding can identify the intended work. When you ask for a concrete deliverable, the agent checks the project and reuses the ticket that covers it. If it finds no match, it creates one when authorized. Asking a question or browsing stays read-only. The agent runs the check in its own environment and sends the result back to GeniusTasker.

## Find the right connection and ticket

If you want to choose the ticket yourself before work begins, ask in ChatGPT or another MCP client:

> Show my connected GeniusTasker account, environment and agent profile. Find the project I named. Tell me whether you can read its tickets and report work there. Help me choose one ticket and wait for my choice before starting.

The agent reads identity, capabilities and the matching project. It reads the project's saved instructions and contribution switch, then the selected ticket. A selected project can be readable even when agent contributions are paused. If the account or project differs from the one you intended, stop before writing. In the app, check **Account → Agents** for the connection and the project's agent settings for contribution status. The connection and profile both limit the available permissions. Membership and the ticket rules still apply.

You can inspect the same facts from the CLI. This example uses the production data shared by TestFlight. Keep the environment and context consistent. Replace PROJECT_ID and TASK_ID with values returned by your own reads.

```sh
geniustasker whoami --context work --environment production --json
geniustasker capabilities --context work --environment production --json
geniustasker projects list --context work --environment production --json
geniustasker resources list --scope project:PROJECT_ID --collection project --id PROJECT_ID --context work --environment production --json
geniustasker resources list --scope project:PROJECT_ID --collection tasks --id TASK_ID --task-state v2 --context work --environment production --json
```

Follow a returned project cursor only as far as necessary to identify your project. Missing results on a partial page do not establish that a project is absent. For read-only access, the agent can describe the selected ticket and its acceptance criteria.

For recurring work, ask “Fix the launch regression in this project and test the offline path.” The agent looks for that outcome in the project, records the failing and passing checks under the same ticket and verifies its saved state. Review the full guidance with `geniustasker workflow show --topic project-work --json` or the connector’s `tasker_workflow`.

## Follow the work

| What you see     | What the agent does                                                                                                          | What it establishes                                                                                                                  |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Request prepared | Names the selected project and ticket, objective and check. A prompt can be copied into your agent.                          | You have a request. Handing it to the agent authorizes only the work you described.                                                  |
| In progress      | Claims the ticket when work begins, saves the operation receipt, patches the ticket to InProgress and reads it back.         | The current worker has acknowledged this ticket. Progress updates describe what that worker actually observed.                       |
| Interrupted      | Sends run.pause with the actual reason and next step, then reads back Paused and Waiting. Uses run.resume when work resumes. | Another person can see where to continue. An expired signal alone cannot tell you why work stopped.                                  |
| Awaiting review  | Supplies evidence and names the remaining check or decision.                                                                 | The result still needs review. A link or a completion report only establishes what its author submitted.                             |
| Verified result  | Runs the agreed check, records the observed result and verifier, then confirms the saved ticket and run states.              | You can inspect the evidence, repeat the check and see any limits. If human review was required, its decision must exist separately. |

In the app, open the ticket's agent activity to read its report and evidence. Open the project's agent reports to move between tickets. For the README example, evidence can be the actual commit plus the specific command, exit status and installed version. Keep secrets, private signed links, full logs and unrelated account data outside the report.

For a lost response, retry the same prepared operation. For a revision conflict or expired claim, read the task and its run again. A new command requires the latest revision and a current, authorized claim. [Run commands, recovery and handoff](../skills/geniustasker/references/agent-runs.md)
