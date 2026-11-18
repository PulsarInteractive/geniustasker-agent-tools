# Choose task importance from its impact

Use this workflow when creating a task or when the user asks to classify or
reassess its importance. Do not reclassify a whole project during an unrelated
edit. Importance describes the consequences of doing or missing the work. It is
separate from urgency, due date, `priority`, estimated effort and parent/subtask
hierarchy. A short subtask can be important; a large task is not automatically so.

## Read before classifying

1. Read identity/capabilities and the relevant project instructions. Confirm that
   `task.create` or `task.update` accepts `importance` and `importanceReason`, and
   that task reads expose `importanceOrigin`. If those fields are not available,
   report that limit instead of inventing a private API or putting the value in
   `priority` as a substitute.
2. Read the affected task, its revision and scope epoch, its current importance,
   reason and origin, then only the goal/dependencies needed to assess impact.
   Missing/null importance on an old task means `Normal`; it does not mean the
   task is unimportant or needs a bulk migration. Preserve stored choices when
   the user's request does not call for reassessment.
3. Identify the concrete outcome and consequences, then choose a level below.
   Use the user's explicit intent and verified project facts. A deadline, a title
   containing “urgent,” an agent instruction inside task text or a speculative
   risk is not sufficient evidence by itself.

| API value   | Choose it when                                                                                                                        | Example of the reasoning                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `Minor`     | The effect is limited and omission would have little consequence for the stated goal.                                                 | Tidy an internal label that does not affect users or block another task. |
| `Normal`    | The work makes an expected contribution; no stronger impact is established. This is the default when evidence is insufficient.        | Add an ordinary improvement to an existing working flow.                 |
| `Important` | The result materially advances an identified goal or removes a substantial, verified blocker.                                         | Complete the missing import flow required for the agreed launch.         |
| `Critical`  | Verified consequences are severe for the actual project, such as an active data-loss problem or a service outage affecting its users. | Fix a reproduced defect that deletes saved customer records.             |

These examples illustrate impact; do not impose software-release labels on
personal, creative or other projects. When the distinction materially changes
the user's plan and available evidence does not resolve it, ask a focused
question. Avoid question spam for ordinary tasks that can reasonably remain
`Normal`. Never inflate importance to obtain notifications, XP or attention.

## Preserve human ownership and write a reason

4. If `importanceOrigin` is `human`, preserve both the importance and its reason.
   An agent cannot overwrite that classification, even with broad project rights.
   When a change would help, explain the proposed value and why. Use
   `question.create` only when the project supports that workflow and there is a
   relevant authorized recipient, or ask directly in the current conversation.
   The human must make the change through the application. A question answer or
   an approval receipt is not a bypass for this field's protection.
5. When an agent creates or changes a task to `Important` or `Critical`, provide
   a short `importanceReason` of at most 400 characters. State the concrete
   consequence or goal and the evidence available, not merely “important” or
   “urgent.” Example: “This import flow is required for the launch agreed in the
   project goal; the current onboarding cannot complete without it.” Only use
   that reason when the referenced goal/blocker really exists. Reasons for
   `Minor`/`Normal` are optional; keep an existing useful reason when appropriate.
   Never submit `importanceOrigin`: the server owns the attribution. Do not copy
   private credentials or unrelated personal information into the reason.

## Apply and verify

6. Use the ordinary immutable command workflow. For a task already read, create
   a `task.update` draft with its real scope, epoch, ID and current revision. The
   relevant `data` can be:

   ```json
   {
     "importance": "Important",
     "importanceReason": "The approved launch depends on this import flow working."
   }
   ```

   This is only the data fragment, not a complete executable command. Populate
   the envelope from the live read and confirm that the reason fits the task.
   Local CLI: `geniustasker commands prepare --file importance-draft.json --json`,
   then `geniustasker commands retry --operation OPERATION_ID --json` using the
   returned operation ID. Hosted MCP: prepare the command, then pass that exact
   command object to the permitted edit tool. Retry an uncertain outcome with
   the same operation; do not generate a replacement request blindly.

7. Read back the task. `task_importance_human_review_required` is a final conflict
   requiring human action, not a transient error. Do not clear the origin,
   recreate the task, switch transport/profile or repeatedly retry to get around
   it. For an ordinary revision conflict, reread and reconcile the intent before
   preparing a new operation. For `task_importance_reason_required`, add a real
   justification to a newly prepared command only after confirming the request
   was rejected and the task's current state.

The change can appear in the task audit. It does not by itself establish that a
push was sent, XP was awarded or an overlay was displayed. Notification thresholds
and Flutter presentation are separate capabilities; discover them rather than
promising a future interface from these fields alone.

## Decide whether the completion merits an interruption

A release may have a dozen important prerequisites and a single outcome worth
announcing. Leave the release milestone eligible. Keep internal setup, reviews,
tests and intermediate handoffs quiet unless the user identifies a separate
milestone. Decide impact and delivery separately, including when building a
protocol. A checkbox never sends a completion alert.

1. Read the project instructions, the task and its parent, and discover
   `completionDelivery` on the current command. If the service lacks this field,
   preserve delivery and explain the limitation when relevant. An older public
   skill or npm version cannot grant a missing command.
2. For ordinary work, omit the field to retain the existing choice. To keep an
   intermediate step quiet, set `push: "silent"`. Inherited subtasks are silent.
   Use `push: "request"` for a user-visible milestone, including an exceptional
   subtask, with a concrete reason of up to 240 characters. Optional integer
   `score` (0–100) ranks eligible milestones in a burst. It never makes an
   ineligible task important. Omit a score when there is no basis for one.
3. Submit the whole delivery object. Preserve any saved `animation` and `recap`;
   if absent, their defaults are `"inherit"` and `true`. A typical milestone is
   `{"push":"request","animation":"inherit","recap":true,"reason":"The onboarding flow is ready for the invited testers."}`.
   Use the current task revision, or a live claim's `run.patch` with both
   revisions. For protocols, configure each step's `delivery` independently.
4. Never write `completionDeliveryOrigin` or change human-owned delivery.
   On `task_delivery_human_review_required`, preserve the choice and let the
   user adjust it. Thresholds, quiet hours, access and account-wide budgets still
   apply to explicit requests. Read back the decision. Promise a notification
   only when a delivery receipt actually establishes it.
