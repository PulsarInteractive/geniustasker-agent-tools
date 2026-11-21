// Generated from contracts/agents.tsp. Do not edit by hand.
export default {
  "maxCommandBytes": 131072,
  "commands": {
    "approval.cancel": {
      "fields": [
        "requestVersion"
      ],
      "module": "Project/ProjectTaskComment",
      "permission": "approvals:write"
    },
    "approval.consume": {
      "fields": [
        "requestVersion",
        "actionJson"
      ],
      "module": "Project/ProjectTaskComment",
      "permission": "approvals:write"
    },
    "approval.request": {
      "create": true,
      "fields": [
        "task",
        "taskRevision",
        "title",
        "summary",
        "actionJson",
        "approver",
        "expiresAt"
      ],
      "module": "Project/ProjectTaskComment",
      "permission": "approvals:write"
    },
    "checklist.create": {
      "action": "createChecklistItem",
      "create": true,
      "fields": [
        "task",
        "title",
        "sectionId"
      ],
      "inputSchema": "GeniusTasker.Checklists.Create",
      "module": "Project/ProjectTaskChecklistItem",
      "permission": "tasks:write"
    },
    "checklist.move": {
      "action": "moveChecklistItem",
      "fields": [
        "task",
        "neighborId",
        "neighborRevision"
      ],
      "inputSchema": "GeniusTasker.Checklists.Move",
      "module": "Project/ProjectTaskChecklistItem",
      "permission": "tasks:write"
    },
    "checklist.remove": {
      "action": "removeChecklistItem",
      "delete": true,
      "fields": [
        "task"
      ],
      "inputSchema": "GeniusTasker.Checklists.Remove",
      "module": "Project/ProjectTaskChecklistItem",
      "permission": "tasks:write"
    },
    "checklist.update": {
      "action": "updateChecklistItem",
      "fields": [
        "task",
        "title",
        "checked"
      ],
      "inputSchema": "GeniusTasker.Checklists.Update",
      "module": "Project/ProjectTaskChecklistItem",
      "permission": "tasks:write"
    },
    "comment.create": {
      "create": true,
      "fields": [
        "task",
        "text",
        "mentions"
      ],
      "module": "Project/ProjectTaskComment",
      "permission": "comments:write"
    },
    "comment.delete": {
      "delete": true,
      "fields": [],
      "module": "Project/ProjectTaskComment",
      "permission": "comments:write"
    },
    "comment.update": {
      "fields": [
        "text",
        "mentions"
      ],
      "module": "Project/ProjectTaskComment",
      "permission": "comments:write"
    },
    "document.create": {
      "create": true,
      "fields": [
        "title",
        "content",
        "folder"
      ],
      "module": "Project/ProjectDocument",
      "permission": "tasks:write"
    },
    "document.delete": {
      "delete": true,
      "fields": [],
      "module": "Project/ProjectDocument",
      "permission": "tasks:write"
    },
    "document.update": {
      "fields": [
        "title",
        "content",
        "folder"
      ],
      "module": "Project/ProjectDocument",
      "permission": "tasks:write"
    },
    "filter.create": {
      "create": true,
      "fields": [
        "name",
        "criteria"
      ],
      "module": "Project/ProjectTaskFilter",
      "permission": "tasks:write"
    },
    "filter.delete": {
      "delete": true,
      "fields": [],
      "module": "Project/ProjectTaskFilter",
      "permission": "tasks:write"
    },
    "filter.update": {
      "fields": [
        "name",
        "criteria"
      ],
      "module": "Project/ProjectTaskFilter",
      "permission": "tasks:write"
    },
    "folder.create": {
      "create": true,
      "fields": [
        "name",
        "parent"
      ],
      "module": "Project/ProjectDocumentFolder",
      "permission": "tasks:write"
    },
    "folder.delete": {
      "delete": true,
      "fields": [],
      "module": "Project/ProjectDocumentFolder",
      "permission": "tasks:write"
    },
    "folder.update": {
      "fields": [
        "name",
        "parent"
      ],
      "module": "Project/ProjectDocumentFolder",
      "permission": "tasks:write"
    },
    "goal.create": {
      "create": true,
      "fields": [
        "title",
        "owner",
        "isTeamOwner",
        "period",
        "interval",
        "startTime",
        "taskNumber",
        "scheduleTaskOnly",
        "notification",
        "alertNotification"
      ],
      "module": "Project/ProjectMemberGoals",
      "permission": "goals:write"
    },
    "goal.delete": {
      "delete": true,
      "fields": [],
      "module": "Project/ProjectMemberGoals",
      "permission": "goals:write"
    },
    "goal.update": {
      "fields": [
        "title",
        "owner",
        "isTeamOwner",
        "period",
        "interval",
        "startTime",
        "taskNumber",
        "scheduleTaskOnly",
        "notification",
        "alertNotification"
      ],
      "module": "Project/ProjectMemberGoals",
      "permission": "goals:write"
    },
    "intent.change": {
      "action": "coachIntent",
      "fields": [
        "decision",
        "id",
        "expectedIntentRevision",
        "selection",
        "sourceVersion",
        "replaces"
      ],
      "inputSchema": "GeniusTasker.CoachIntents.TaskerIntentCommand",
      "module": "$private/TaskerCoachIntents",
      "permission": "tasks:write",
      "upsert": true
    },
    "memory.create": {
      "create": true,
      "fields": [
        "logoAssetId",
        "contentRoles",
        "designFilters",
        "title",
        "productKey",
        "summary",
        "instructions",
        "color",
        "kind"
      ],
      "module": "Memory/$",
      "permission": "memory:write"
    },
    "memory.edge.create": {
      "create": true,
      "fields": [
        "source",
        "target",
        "relation",
        "label",
        "note",
        "certainty",
        "references",
        "provenance"
      ],
      "module": "Memory/MemoryEdge",
      "permission": "memory:write"
    },
    "memory.edge.delete": {
      "delete": true,
      "fields": [],
      "module": "Memory/MemoryEdge",
      "permission": "memory:write"
    },
    "memory.edge.update": {
      "fields": [
        "source",
        "target",
        "relation",
        "label",
        "note",
        "certainty",
        "references",
        "provenance"
      ],
      "module": "Memory/MemoryEdge",
      "permission": "memory:write"
    },
    "memory.node.create": {
      "create": true,
      "fields": [
        "imageAssetId",
        "detailLevel",
        "title",
        "summary",
        "text",
        "kind",
        "authority",
        "certainty",
        "tags",
        "references",
        "sourceId",
        "provenance"
      ],
      "module": "Memory/MemoryNode",
      "permission": "memory:write"
    },
    "memory.node.delete": {
      "delete": true,
      "fields": [],
      "module": "Memory/MemoryNode",
      "permission": "memory:write"
    },
    "memory.node.update": {
      "fields": [
        "imageAssetId",
        "detailLevel",
        "title",
        "summary",
        "text",
        "kind",
        "authority",
        "certainty",
        "tags",
        "references",
        "sourceId",
        "provenance"
      ],
      "module": "Memory/MemoryNode",
      "permission": "memory:write"
    },
    "memory.page.create": {
      "create": true,
      "fields": [
        "changeReason",
        "visibility",
        "readRoles",
        "title",
        "path",
        "summary",
        "agentInstructions",
        "guide",
        "design",
        "designReview",
        "designThread",
        "blocks",
        "tags",
        "provenance",
        "sourceId",
        "parentId",
        "directory",
        "order",
        "kind",
        "state",
        "authority",
        "section",
        "metadataJson"
      ],
      "module": "Memory/MemoryPage",
      "permission": "memory:write"
    },
    "memory.page.delete": {
      "action": "retireMemoryPage",
      "fields": [
        "changeReason"
      ],
      "module": "Memory/MemoryPage",
      "permission": "memory:write"
    },
    "memory.page.proposeRevision": {
      "action": "proposeDecisionRevision",
      "fields": [
        "blockId",
        "original",
        "replacement",
        "evidenceKind",
        "evidenceRef"
      ],
      "module": "Memory/MemoryPage",
      "permission": "memory:write"
    },
    "memory.page.restore": {
      "action": "restoreMemoryVersion",
      "fields": [
        "revision"
      ],
      "module": "Memory/MemoryPage",
      "permission": "memory:write"
    },
    "memory.page.update": {
      "fields": [
        "changeReason",
        "visibility",
        "readRoles",
        "title",
        "path",
        "summary",
        "agentInstructions",
        "guide",
        "design",
        "designReview",
        "designThread",
        "blocks",
        "tags",
        "provenance",
        "sourceId",
        "parentId",
        "directory",
        "order",
        "kind",
        "state",
        "authority",
        "section",
        "metadataJson"
      ],
      "module": "Memory/MemoryPage",
      "permission": "memory:write"
    },
    "memory.update": {
      "fields": [
        "logoAssetId",
        "contentRoles",
        "designFilters",
        "title",
        "productKey",
        "summary",
        "instructions",
        "color",
        "kind"
      ],
      "module": "Memory/$",
      "permission": "memory:write"
    },
    "metric.correct": {
      "action": "correctMetric",
      "fields": [
        "observedAt",
        "measurement",
        "reason"
      ],
      "inputSchema": "GeniusTasker.Metrics.Correct",
      "module": "Project/ProjectMetricObservation",
      "permission": "metrics:write",
      "personalModule": "LocalUser/LocalUserMetricObservation"
    },
    "metric.create": {
      "action": "configureMetric",
      "create": true,
      "fields": [
        "configuration"
      ],
      "inputSchema": "GeniusTasker.Metrics.Configure",
      "module": "Project/ProjectMetricDefinition",
      "permission": "metrics:write",
      "personalModule": "LocalUser/LocalUserMetricDefinition"
    },
    "metric.delete": {
      "delete": true,
      "fields": [],
      "module": "Project/ProjectMetricDefinition",
      "permission": "metrics:write",
      "personalModule": "LocalUser/LocalUserMetricDefinition"
    },
    "metric.goal.create": {
      "action": "configureMetricGoal",
      "create": true,
      "fields": [
        "configuration"
      ],
      "inputSchema": "GeniusTasker.MetricGoals.ConfigureGoal",
      "module": "Project/ProjectMetricGoal",
      "permission": "metrics:write",
      "personalModule": "LocalUser/LocalUserMetricGoal"
    },
    "metric.goal.delete": {
      "delete": true,
      "fields": [],
      "module": "Project/ProjectMetricGoal",
      "permission": "metrics:write",
      "personalModule": "LocalUser/LocalUserMetricGoal"
    },
    "metric.goal.update": {
      "action": "configureMetricGoal",
      "fields": [
        "configuration"
      ],
      "inputSchema": "GeniusTasker.MetricGoals.ConfigureGoal",
      "module": "Project/ProjectMetricGoal",
      "permission": "metrics:write",
      "personalModule": "LocalUser/LocalUserMetricGoal"
    },
    "metric.record": {
      "action": "recordMetric",
      "create": true,
      "fields": [
        "metricId",
        "measurementVersion",
        "sourceKey",
        "sourceLabel",
        "observedAt",
        "measurement"
      ],
      "inputSchema": "GeniusTasker.Metrics.Record",
      "module": "Project/ProjectMetricObservation",
      "permission": "metrics:write",
      "personalModule": "LocalUser/LocalUserMetricObservation"
    },
    "metric.update": {
      "action": "configureMetric",
      "fields": [
        "configuration"
      ],
      "inputSchema": "GeniusTasker.Metrics.Configure",
      "module": "Project/ProjectMetricDefinition",
      "permission": "metrics:write",
      "personalModule": "LocalUser/LocalUserMetricDefinition"
    },
    "metric.void": {
      "action": "voidMetric",
      "fields": [
        "reason"
      ],
      "inputSchema": "GeniusTasker.Metrics.Void",
      "module": "Project/ProjectMetricObservation",
      "permission": "metrics:write",
      "personalModule": "LocalUser/LocalUserMetricObservation"
    },
    "project.configureDocumentation": {
      "action": "configureDocumentation",
      "fields": [
        "documentation"
      ],
      "inputSchema": "GeniusTasker.Contracts.AgentDocumentationSettings",
      "module": "Project/$",
      "permission": "projects:write"
    },
    "project.configureInstructions": {
      "action": "configureAgentInstructions",
      "fields": [
        "instructions"
      ],
      "inputSchema": "GeniusTasker.Contracts.AgentProjectInstructions",
      "module": "Project/$",
      "permission": "projects:write"
    },
    "project.create": {
      "create": true,
      "fields": [
        "title",
        "key",
        "type",
        "icon"
      ],
      "module": "Project/$",
      "permission": "projects:write"
    },
    "project.features": {
      "action": "features",
      "fields": [
        "backlog",
        "sprints",
        "hierarchy",
        "workflows",
        "votes",
        "gitHub",
        "sprintDeadlines",
        "timeZone"
      ],
      "module": "Project/$",
      "permission": "projects:write"
    },
    "project.update": {
      "fields": [
        "title",
        "key",
        "icon",
        "showUserIcon",
        "showTaskIcons",
        "dynamicProgression",
        "autoArchiveDelay"
      ],
      "module": "Project/$",
      "permission": "projects:write"
    },
    "protocol.apply": {
      "action": "applyProtocol",
      "fields": [
        "digest",
        "from",
        "count"
      ],
      "inputSchema": "GeniusTasker.Protocols.Apply",
      "module": "Project/ProjectProtocolInstance",
      "permission": "tasks:write"
    },
    "protocol.cancel": {
      "action": "cancelProtocol",
      "fields": [],
      "inputSchema": "GeniusTasker.Protocols.Cancel",
      "module": "Project/ProjectProtocolInstance",
      "permission": "tasks:write"
    },
    "protocol.publish": {
      "action": "publishProtocol",
      "create": true,
      "fields": [
        "definition",
        "previousVersionId"
      ],
      "inputSchema": "GeniusTasker.Protocols.Publish",
      "module": "Project/ProjectTaskTemplate",
      "permission": "tasks:write"
    },
    "protocol.start": {
      "action": "startProtocol",
      "create": true,
      "fields": [
        "protocolVersionId",
        "bindings"
      ],
      "inputSchema": "GeniusTasker.Protocols.Start",
      "module": "Project/ProjectProtocolInstance",
      "permission": "tasks:write"
    },
    "question.close": {
      "fields": [],
      "module": "Project/ProjectVote",
      "permission": "questions:write"
    },
    "question.create": {
      "create": true,
      "fields": [
        "task",
        "question",
        "description",
        "answerKind",
        "options",
        "selection",
        "anonymous",
        "eligibleUsers",
        "closesAt"
      ],
      "module": "$private/VoteDraft",
      "permission": "questions:write"
    },
    "run.checklist": {
      "action": "checklistRunTask",
      "fields": [
        "taskRevision",
        "itemId",
        "itemRevision",
        "change"
      ],
      "inputSchema": "GeniusTasker.Runs.Checklist",
      "module": "Project/ProjectAgentRun",
      "permission": "tasks:write"
    },
    "run.checkpoint": {
      "action": "checkpointRun",
      "fields": [
        "state",
        "summary",
        "nextSteps",
        "evidence",
        "leaseSeconds"
      ],
      "inputSchema": "GeniusTasker.Runs.Report",
      "module": "Project/ProjectAgentRun",
      "permission": "tasks:write"
    },
    "run.claim": {
      "action": "claimRun",
      "create": true,
      "fields": [
        "task",
        "taskRevision",
        "summary",
        "leaseSeconds"
      ],
      "inputSchema": "GeniusTasker.Runs.Claim",
      "module": "Project/ProjectAgentRun",
      "permission": "tasks:write"
    },
    "run.finish": {
      "action": "finishRun",
      "fields": [
        "state",
        "summary",
        "nextSteps",
        "evidence"
      ],
      "inputSchema": "GeniusTasker.Runs.Finish",
      "module": "Project/ProjectAgentRun",
      "permission": "tasks:write"
    },
    "run.lock": {
      "action": "lockRunTask",
      "fields": [
        "taskRevision",
        "reason"
      ],
      "inputSchema": "GeniusTasker.Runs.Lock",
      "module": "Project/ProjectAgentRun",
      "permission": "tasks:write"
    },
    "run.patch": {
      "action": "patchRunTask",
      "fields": [
        "taskRevision",
        "patch"
      ],
      "inputSchema": "GeniusTasker.Runs.Patch",
      "module": "Project/ProjectAgentRun",
      "permission": "tasks:write"
    },
    "run.pause": {
      "action": "pauseRunTask",
      "fields": [
        "taskRevision",
        "reason",
        "nextSteps"
      ],
      "inputSchema": "GeniusTasker.Runs.Pause",
      "module": "Project/ProjectAgentRun",
      "permission": "tasks:write"
    },
    "run.resume": {
      "action": "resumeRunTask",
      "fields": [
        "taskRevision"
      ],
      "inputSchema": "GeniusTasker.Runs.Resume",
      "module": "Project/ProjectAgentRun",
      "permission": "tasks:write"
    },
    "run.unlock": {
      "action": "unlockRunTask",
      "fields": [
        "taskRevision"
      ],
      "inputSchema": "GeniusTasker.Runs.Unlock",
      "module": "Project/ProjectAgentRun",
      "permission": "tasks:write"
    },
    "schedule.create": {
      "create": true,
      "fields": [
        "title",
        "description",
        "owner",
        "period",
        "interval",
        "startTime",
        "weekDay",
        "timeZoneId",
        "dueDateEnabled",
        "dueOffsetDays",
        "dependency",
        "workflowId",
        "workflowOrder",
        "workflowDependencies",
        "estimateDays",
        "autoArchive",
        "autoArchiveDays",
        "autoArchiveHours",
        "notification",
        "alertNotification",
        "dynamicTitle",
        "keepMissedOccurrences"
      ],
      "module": "Project/ProjectScheduledTask",
      "permission": "tasks:write"
    },
    "schedule.delete": {
      "delete": true,
      "fields": [],
      "module": "Project/ProjectScheduledTask",
      "permission": "tasks:write"
    },
    "schedule.update": {
      "fields": [
        "title",
        "description",
        "owner",
        "period",
        "interval",
        "startTime",
        "weekDay",
        "timeZoneId",
        "dueDateEnabled",
        "dueOffsetDays",
        "dependency",
        "workflowId",
        "workflowOrder",
        "workflowDependencies",
        "estimateDays",
        "autoArchive",
        "autoArchiveDays",
        "autoArchiveHours",
        "notification",
        "alertNotification",
        "dynamicTitle",
        "keepMissedOccurrences"
      ],
      "module": "Project/ProjectScheduledTask",
      "permission": "tasks:write"
    },
    "sprint.complete": {
      "action": "complete",
      "fields": [
        "carryToSprint"
      ],
      "module": "Project/ProjectSprint",
      "permission": "tasks:write"
    },
    "sprint.create": {
      "action": "save",
      "create": true,
      "fields": [
        "name",
        "goal",
        "start",
        "end"
      ],
      "module": "Project/ProjectSprint",
      "permission": "tasks:write"
    },
    "sprint.delete": {
      "delete": true,
      "fields": [],
      "module": "Project/ProjectSprint",
      "permission": "tasks:write"
    },
    "sprint.start": {
      "action": "start",
      "fields": [],
      "module": "Project/ProjectSprint",
      "permission": "tasks:write"
    },
    "sprint.update": {
      "action": "save",
      "fields": [
        "name",
        "goal",
        "start",
        "end"
      ],
      "module": "Project/ProjectSprint",
      "permission": "tasks:write"
    },
    "tag.create": {
      "create": true,
      "fields": [
        "name",
        "backgroundColor",
        "textColor"
      ],
      "module": "Project/ProjectCustomTag",
      "permission": "tasks:write"
    },
    "tag.delete": {
      "delete": true,
      "fields": [],
      "module": "Project/ProjectCustomTag",
      "permission": "tasks:write"
    },
    "tag.update": {
      "fields": [
        "name",
        "backgroundColor",
        "textColor"
      ],
      "module": "Project/ProjectCustomTag",
      "permission": "tasks:write"
    },
    "task.archive": {
      "fields": [],
      "module": "Project/ProjectTask",
      "permission": "tasks:write"
    },
    "task.create": {
      "create": true,
      "fields": [
        "title",
        "description",
        "importance",
        "importanceReason",
        "completionDelivery",
        "type",
        "owner",
        "status",
        "enableDueDate",
        "dueDate",
        "estimateDays",
        "quantity",
        "quantityUnit",
        "autoArchive",
        "autoArchiveDays",
        "autoArchiveHours",
        "dependencies",
        "tags"
      ],
      "inputSchema": "GeniusTasker.AgentTasks.Create",
      "module": "Project/ProjectTask",
      "permission": "tasks:write"
    },
    "task.delete": {
      "delete": true,
      "fields": [],
      "module": "Project/ProjectTask",
      "permission": "tasks:delete"
    },
    "task.lock": {
      "action": "lockTask",
      "fields": [
        "reason"
      ],
      "inputSchema": "GeniusTasker.TaskPlanning.LockTask",
      "module": "Project/ProjectTask",
      "permission": "tasks:write"
    },
    "task.pause": {
      "action": "pauseTask",
      "fields": [
        "reason",
        "nextSteps"
      ],
      "inputSchema": "GeniusTasker.TaskPlanning.PauseTask",
      "module": "Project/ProjectTask",
      "permission": "tasks:write"
    },
    "task.report": {
      "fields": [
        "phase",
        "summary",
        "nextSteps",
        "evidence",
        "mentions"
      ],
      "module": "Project/ProjectTask",
      "permission": "tasks:write"
    },
    "task.restore": {
      "fields": [],
      "module": "Project/ProjectTask",
      "permission": "tasks:write"
    },
    "task.resume": {
      "action": "resumeTask",
      "fields": [],
      "inputSchema": "GeniusTasker.TaskPlanning.ResumeTask",
      "module": "Project/ProjectTask",
      "permission": "tasks:write"
    },
    "task.unlock": {
      "action": "unlockTask",
      "fields": [],
      "inputSchema": "GeniusTasker.TaskPlanning.UnlockTask",
      "module": "Project/ProjectTask",
      "permission": "tasks:write"
    },
    "task.update": {
      "fields": [
        "title",
        "description",
        "importance",
        "importanceReason",
        "completionDelivery",
        "type",
        "owner",
        "status",
        "enableDueDate",
        "dueDate",
        "estimateDays",
        "quantity",
        "quantityUnit",
        "autoArchive",
        "autoArchiveDays",
        "autoArchiveHours",
        "dependencies",
        "tags"
      ],
      "inputSchema": "GeniusTasker.AgentTasks.Update",
      "module": "Project/ProjectTask",
      "permission": "tasks:write"
    },
    "ticket.create": {
      "create": true,
      "fields": [
        "title",
        "description",
        "kind",
        "placement",
        "sprint",
        "parent",
        "details",
        "planning"
      ],
      "module": "Project/ProjectTask",
      "permission": "tasks:write"
    },
    "ticket.plan": {
      "fields": [
        "changes"
      ],
      "module": "Project/$",
      "permission": "tasks:write"
    },
    "workflow.create": {
      "action": "save",
      "create": true,
      "fields": [
        "name",
        "category",
        "order"
      ],
      "module": "Project/ProjectWorkflowStage",
      "permission": "tasks:write"
    },
    "workflow.delete": {
      "delete": true,
      "fields": [
        "replacement"
      ],
      "module": "Project/ProjectWorkflowStage",
      "permission": "tasks:write"
    },
    "workflow.update": {
      "action": "save",
      "fields": [
        "name",
        "category",
        "order"
      ],
      "module": "Project/ProjectWorkflowStage",
      "permission": "tasks:write"
    }
  },
  "changes": {
    "pollIntervalSeconds": 5,
    "maxWatchSeconds": 60
  },
  "grants": {
    "permissions": [
      "tasks:delete",
      "storage:read",
      "attachments:add",
      "attachments:replace",
      "attachments:remove",
      "history:read",
      "projects:read",
      "projects:write",
      "tasks:read",
      "tasks:write",
      "comments:write",
      "questions:write",
      "approvals:write",
      "goals:read",
      "goals:write",
      "metrics:read",
      "metrics:write",
      "memory:read",
      "memory:write",
      "media:read",
      "media:write",
      "feedback:read",
      "feedback:write"
    ],
    "maxResources": 200,
    "maxProfilesPerConnection": 20
  }
};
