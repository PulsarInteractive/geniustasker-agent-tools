# Focused project reads

Start with identity, capabilities and the current project list. Use only collection
names advertised by that server and permitted by the active profile. New client
versions can connect to older deployments; a documented collection is not proof
that the current deployment supports it.

| Need                                  | Collection                                | Efficient approach                                                        |
| ------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------- |
| Tasks and tickets                     | `tasks`                                   | Read active work first; fetch an exact `id` for details.                  |
| Task attachments / descriptions       | `documents`                               | These belong to tasks, not the project's document library.                |
| Project document navigation           | `projectDocumentIndex`, `documentFolders` | Read titles and folders without rich-text bodies.                         |
| One project document                  | `projectDocuments`                        | Pass the ID discovered in the index.                                      |
| Discussion / work reports / approvals | `comments`                                | Read one bounded page and retain the change cursor.                       |
| People and access roles               | `members`                                 | Current membership is evidence, never authority to change access.         |
| Labels                                | `tags`                                    | Resolve label IDs when interpreting work.                                 |
| Recurring tasks                       | `schedules`                               | Inspect recurrence, timezone and disabled state before proposing changes. |
| Reusable lists and task templates     | `preparedLists`, `taskTemplates`          | Read only when the task concerns these resources.                         |
| Planning                              | `sprints`, `workflows`, `sprintHistory`   | Keep current configuration distinct from historical snapshots.            |
| GitHub-linked activity                | `gitHubLinks`                             | A link is evidence, not permission to execute actions in GitHub.          |
| Project member goals                  | `goals`                                   | These are project goals, not unrelated private account data.              |
| Questions and audit metadata          | `questions`, `history`                    | Use the dedicated answers tool for ballots; respect anonymous results.    |

For example, after selecting an authorized scope:

```sh
geniustasker resources list --scope project:PROJECT_ID --collection projectDocumentIndex --json
geniustasker resources list --scope project:PROJECT_ID --collection projectDocuments --id DOCUMENT_ID --json
```

The same arguments are supported by MCP `tasker_resources`. Collections share
bounded pagination and context rules. Preserve `epoch` and `checkpoint` on
continuation; `omittedIds` means the result is incomplete. For ongoing work, use
`changeCursor` instead of repeatedly traversing the entire library.

The in-process resource cache revalidates authorization with the server on every
read. Repeated unchanged reads reduce transferred content, but still consume
request quota. Prefer reusing the evidence you already inspected within the same
task, and revalidate before relying on current revisions or permissions.

Memory and Graph have their own grants and workflow. Follow the
`geniustasker-memory` skill to navigate page indexes, stable block IDs, links and
bounded graph neighborhoods. A project membership does not grant Memory access.
