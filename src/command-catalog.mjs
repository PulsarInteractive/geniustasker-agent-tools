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
    "memory.create": {
      "create": true,
      "fields": [
        "contentRoles",
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
    "memory.delete": {
      "delete": true,
      "fields": [],
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
        "visibility",
        "readRoles",
        "title",
        "path",
        "summary",
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
      "delete": true,
      "fields": [],
      "module": "Memory/MemoryPage",
      "permission": "memory:write"
    },
    "memory.page.update": {
      "fields": [
        "visibility",
        "readRoles",
        "title",
        "path",
        "summary",
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
        "contentRoles",
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
    "task.update": {
      "fields": [
        "title",
        "description",
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
    }
  },
  "changes": {
    "pollIntervalSeconds": 5,
    "maxWatchSeconds": 60
  },
  "grants": {
    "permissions": [
      "projects:read",
      "tasks:read",
      "tasks:write",
      "comments:write",
      "questions:write",
      "approvals:write",
      "goals:read",
      "goals:write",
      "memory:read",
      "memory:write",
      "media:read",
      "media:write"
    ],
    "maxResources": 200,
    "maxProfilesPerConnection": 20
  }
};
