# Small steps within a task

Client beta.15 supports checklist commands and bounded reads. Discover the
connected service's `checklist` collection and supported commands first; client
installation alone does not establish server rollout.
Use the normal task read/write grants and current project rights; a checklist
does not grant access to another task or bypass its agent claim.

Use a checklist for small, checkable steps of the same deliverable. Create a
separate ticket when a step needs an independent owner, dependency, deadline or
effort estimate. Do not hide independently planned work inside checkbox text.
Preserve the user's existing breakdown; configure it when requested or within
the authorized task planning scope, without expanding the deliverable. For
example, “verify the form” and “check its error state” can be steps of the same
form fix; a review assigned to a different owner belongs in its own ticket.
Do not split a checklist into tickets merely to raise task counts or rewards.

## Read the relevant task

Read the task, then one bounded checklist page with `collection: "checklist"`
and `taskId` equal to that task's ID. CLI uses `resources list --scope project:ID
--collection checklist --task-id TASK_ID`. To inspect one known item, use its
exact `id`. Follow `nextAfter` with the same taskId, epoch and checkpoint until
the relevant list is complete; do not crawl every task. A filtered checklist
list has no changeCursor. Revalidate it normally after changes; do not invent
an incremental cursor from a checkpoint.

Items expose `task`, `title`, `checked`, `order` and author/time metadata. The
parent task's `checklistCount` and `checklistDoneCount` are server-owned totals.
Use these current totals for a percentage when present, or compute it only from
a complete current list. An empty list is no checklist, not proof of 100% or
completion. A partial page cannot establish the total or final percentage.

## Edit one explicit intent

Inspect `commands describe --kind KIND` or `tasker_command_help` first. Commands
target the **item ID** with null expectedRevision for create and the current
item revision otherwise. New item IDs are UUIDs. Every command includes the
unchanged parent `task` in its data.

| Command            | Data                                                     |
| ------------------ | -------------------------------------------------------- |
| `checklist.create` | `{task,title}`                                           |
| `checklist.update` | `{task,title?,checked?}` with at least one changed field |
| `checklist.move`   | `{task,neighborId,neighborRevision}`                     |
| `checklist.remove` | `{task}`                                                 |

The list holds at most 50 items; title is useful text of 1–240 characters,
nonempty after trimming. Creation appends an unchecked item. Check or uncheck
by sending the desired boolean `checked`, never a toggle. A move swaps the item
with one current adjacent neighbor, using both revisions. Reread after a
neighbor conflict instead of guessing an index or replacing the whole list.
Remove deletes that item and the server compacts the bounded sibling order.
Never patch order, authors, parent counters or an array on the task itself.

Under your live claim, use **run.checklist**, targeting the run ID and its
current revision, with `{taskRevision,itemId,itemRevision,change}`. `itemRevision`
is null for creation and the current item revision otherwise. The nested
`change` includes the same task and the exact discovered action:
`createChecklistItem`, `updateChecklistItem`, `moveChecklistItem` or
`removeChecklistItem`, plus the corresponding fields above. These nested action
values are required; do not send an internal action at the top level of a
normal checklist command. Retain current run, parent task, item and neighbor
revisions as applicable; never bypass a claim with a direct item command.

## Confirm the edit and recover a lost response

Save the item UUID and prepared command before sending. For a lost reply,
CLI `commands retry` and local MCP `tasker_retry_command` take the same
`operationId`. In hosted ChatGPT, retain the `command` object returned by
`tasker_prepare_command` and send that full object unchanged to `tasker_edit_tasks` again.
This preserves the original operation ID, item ID, timestamp and revisions,
including when creating an item. Reconcile a definitive conflict against current
records before preparing a different edit.

For `run.checklist`, the server can acknowledge only the primary `agentRuns` row
in `receipt.items`. The entry’s revision belongs to that run.
`affectedCollections` tells you which collections changed. For example, a
successful create can name `agentRuns`, `tasks` and `checklist` while the item
UUID appears only in the original command. Treat that receipt as successful.
Use the following reads in the same project scope to confirm the result.

| What you need             | Bounded read                                                                                                                            |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Created or updated item   | `collection: "checklist", id: itemId`. Match the parent task and the intended fields.                                                   |
| Reordered or removed item | `collection: "checklist", taskId`. Follow any continuation before concluding that an item is absent; check adjacent order after a move. |
| Progress                  | `collection: "tasks", id: taskId`. Use its current `checklistDoneCount` and `checklistCount`.                                           |
| Next claimed edit         | Read the current run by ID in `agentRuns`, the task and the relevant item or neighbor revisions.                                        |

A cached operation receipt confirms the original edit. Current checklist state
may have changed since then. If permission for the read is unavailable,
report the acknowledged edit and leave the current progress unverified.
Respect current authorization, storage admission and the 50-item limit.

Archived tasks allow authorized reading, but checklist writes are refused. Do
not restore a task merely to bypass that refusal; restoration must itself belong
to the requested work. An unarchived Done task can have its checklist corrected
without reopening it: unchecking leaves Done and its completion history intact.
If the correction reveals unfinished acceptance work, reconcile the task's
progress explicitly within the authorized work; never imply the checkbox
performed a reopening. Paused tasks keep their reason, next steps and pause time
through checklist edits, even when the checklist reaches 100%.

Checking a case records that small step only. It gives no XP or push, and 100%
does not mark the task Done. Editing, checking, moving or clearing a checklist
does not start, resume, unlock, reopen or move Paused work to New. Leave actual
progress and blockers intact; complete the task separately only after verifying
its intended outcome and acceptance criteria.
