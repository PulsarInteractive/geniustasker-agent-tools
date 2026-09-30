# Questions, work reports and precise approvals

## Ask a human without impersonating them

Use `question.create` when a ticket needs a choice, a yes/no opinion or written
information. It needs `questions:write`, an enabled project, a linked ticket,
explicit eligible human IDs and a future closing time. Discover the audience
from actual project access; never guess or add a new member. `Text` is named,
up to 50 recipients and 2,000 UTF-16 code units per answer. `YesNo` has canonical
options; `Choices` supports named or anonymous polls. Reuse the normal immutable
command journal and add a useful ticket comment when appropriate.

Read the `questions` collection and `questions answers --scope project:ID
--question ID --json` / `tasker_question_answers`. Continue with its original
epoch/checkpoint and nextAfter; restart a changed snapshot. Anonymous open polls
reveal neither respondents nor totals; only final totals appear after closing.
There is no delegated ballot command. Do not call private human APIs to answer.

A human answer is information in the ticket, not a credential or universal
permission. Keep external actions inside the user's actual authorization and
agent policy. Use `question.close` only for this profile's own question, with its
current revision. If no answer arrives, record the blocker and proceed only with
independent authorized work; do not invent approval or repeatedly poll rapidly.

## Leave a useful handoff

Use the discovered `task.report` command with `tasks:write`, an open unarchived
agent-enabled task and its current revision. Pick `Working`, `NeedsInformation`
or `NeedsReview`; Tasker keeps its usual New/InProgress/Done lifecycle. Describe
what changed in `summary` (up to 2,000 UTF-16 units). `nextSteps` is required for
information/review requests (up to 4,000 units). Include up to eight explicitly
labeled HTTPS evidence links; never include credentials, signed private URLs or
claim that an author-provided link is independent verification.

The phase and attributed, immutable discussion receipt commit together. A report
moves an open ticket to InProgress, not Done. Read `workPhase` and `lastWorkReport`
on the task, and `workReport` on its comment. Reuse the exact saved operation after
an uncertain response. Correct a published report with a new report, not by
rewriting history. Human users can moderate/delete comments, so a missing receipt
is not an invitation to recreate its text. Completing/reopening the task clears
its current work phase and retains the report as history. A report does not grant
permission or count as approval. Use a question when a human answer is needed.

## Request and consume a precise human decision

Use `approval.request` with `approvals:write` when a concrete action needs a
human's decision. Anchor it to the current open ticket revision, an explicitly
identified approver who can edit that ticket, a concise title/summary, the full
inert action JSON and a deadline one minute to seven days ahead. Include the
actual target/environment/operation parameters. Never put secrets in shared
project history. Keep the original request UUID and journaled operation.

Read the comment's `approval` and current revision. Only the designated human
may decide in the app. Do not impersonate them or interpret a poll, message,
work report or silence as approval. Wait with bounded backoff; continue only
independent authorized work while the decision is pending.

For Approved, consume with the same original profile, current comment revision,
original `requestVersion` and exact reviewed `actionJson`. Tasker rechecks task
revision, expiry, live permissions and approver rights. Cancel and request a new
decision when the action/context changes. An expired, rejected, cancelled or
consumed request is unusable. Approval does not enlarge your grant or override
the host agent/tool's safety policy.

Tasker never executes external tools. A successful consumption receipt records
one authorization use, not the side effect's completion. Bind external effects
to the approval ID using provider idempotency where available. After restart,
inspect external state before retrying an uncertain action; never rerun merely
because replaying consume returns its old success receipt. Finally publish an
honest work report with results/evidence or the remaining blocker.
