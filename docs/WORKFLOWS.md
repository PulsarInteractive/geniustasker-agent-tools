# GeniusTasker workflows

| What you want               | Guide topic  | Operations                                                                                                                 |
| --------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Work on a project           | `projects`   | Read project/member configuration; create/edit/archive/restore tasks; create and plan tickets in existing backlogs/sprints |
| Prepare a shared workflow   | `projects`   | Project tags and saved filters; sprint, recurring schedule and workflow lifecycle                                          |
| Collaborate                 | `projects`   | Comments, work reports, questions, exact action approvals and member goals                                                 |
| Organize knowledge          | `memory`     | Independent Memory spaces, folders/documents, role-restricted content and resource references                              |
| Connect knowledge           | `graph`      | Typed nodes and relations; authorized references across memories                                                           |
| Recover an interrupted edit | `mutations`  | Preserve the exact request; read back; reconcile a revision conflict                                                       |
| Connect or fix permissions  | `connection` | Correct account, consent, reconnect and shared quota                                                                       |

Use `tasker_workflow` in MCP or `geniustasker workflow show --topic TOPIC`.
Discover commands before editing. A readable collection does not imply a matching
write command. See [projects and planning](PLANNING.md) for lifecycle commands.
Membership and consent changes remain in the application.

## Example requests

- “Find my tasks in the current sprint and summarize what blocks them.”
- “Create a project tag named Beta and save a shared filter for those tasks.”
- “Move these tickets into this existing sprint after checking their revisions.”
- “Add this decision to the appropriate Memory folder and link its Graph node.”
- “Refresh this repository’s configured documentation mirror.”

## Local files and linked permissions

Repository mirrors, local image comparison and file upload are CLI/local MCP
workflows. The hosted ChatGPT connector does not access your local disk or upload
an arbitrary chat attachment. Reuse stable asset IDs; compare content before
replacing an image. A Graph link never grants access to its target: when access
is removed, the node remains but linked private data becomes unavailable.

Existing project agent contributions must be enabled by an authorized member.
New projects created with projects:write start with contributions enabled. No tool
can grant itself membership, approve an action as a human, or bypass account
[limits](LIMITS.md).
