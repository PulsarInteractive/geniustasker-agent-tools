// Generated public command data schemas. Do not edit by hand.
export default {
  "intent.change": {
    "type": "object",
    "required": [
      "decision",
      "expectedIntentRevision",
      "id",
      "replaces",
      "selection",
      "sourceVersion"
    ],
    "properties": {
      "decision": {
        "oneOf": [
          {
            "type": "string",
            "enum": [
              "set"
            ]
          },
          {
            "type": "string",
            "enum": [
              "cancel"
            ]
          }
        ]
      },
      "id": {
        "type": "string"
      },
      "expectedIntentRevision": {
        "anyOf": [
          {
            "type": "string",
            "maxLength": 64
          },
          {
            "type": "null"
          }
        ]
      },
      "selection": {
        "anyOf": [
          {
            "type": "object",
            "required": [
              "endsAt",
              "kind",
              "objective",
              "startsAt",
              "taskIds"
            ],
            "properties": {
              "endsAt": {
                "type": "string"
              },
              "kind": {
                "oneOf": [
                  {
                    "type": "string",
                    "enum": [
                      "focus"
                    ]
                  },
                  {
                    "type": "string",
                    "enum": [
                      "defer"
                    ]
                  }
                ]
              },
              "objective": {
                "oneOf": [
                  {
                    "type": "string",
                    "enum": [
                      "finish"
                    ]
                  },
                  {
                    "type": "string",
                    "enum": [
                      "unblock"
                    ]
                  },
                  {
                    "type": "string",
                    "enum": [
                      "consistency"
                    ]
                  },
                  {
                    "type": "string",
                    "enum": [
                      "pause"
                    ]
                  }
                ]
              },
              "startsAt": {
                "anyOf": [
                  {
                    "type": "string"
                  },
                  {
                    "type": "null"
                  }
                ]
              },
              "taskIds": {
                "type": "array",
                "minItems": 1,
                "maxItems": 20,
                "uniqueItems": true,
                "items": {
                  "type": "string"
                }
              }
            },
            "additionalProperties": false
          },
          {
            "type": "null"
          }
        ]
      },
      "sourceVersion": {
        "anyOf": [
          {
            "type": "string",
            "maxLength": 64,
            "pattern": "^[a-f0-9]{64}$"
          },
          {
            "type": "null"
          }
        ]
      },
      "replaces": {
        "type": "array",
        "maxItems": 16,
        "uniqueItems": true,
        "items": {
          "type": "string"
        }
      }
    },
    "additionalProperties": false
  },
  "metric.correct": {
    "type": "object",
    "required": [
      "measurement",
      "observedAt",
      "reason"
    ],
    "properties": {
      "observedAt": {
        "type": "string"
      },
      "measurement": {
        "type": "object",
        "required": [
          "denominator",
          "numerator",
          "value"
        ],
        "properties": {
          "denominator": {
            "anyOf": [
              {
                "type": "number",
                "minimum": 0,
                "maximum": 1000000000
              },
              {
                "type": "null"
              }
            ]
          },
          "numerator": {
            "anyOf": [
              {
                "type": "number",
                "minimum": 0,
                "maximum": 1000000000
              },
              {
                "type": "null"
              }
            ]
          },
          "value": {
            "anyOf": [
              {
                "type": "number",
                "minimum": -1000000000,
                "maximum": 1000000000
              },
              {
                "type": "null"
              }
            ]
          }
        },
        "additionalProperties": false
      },
      "reason": {
        "type": "string",
        "minLength": 1,
        "maxLength": 500
      }
    },
    "additionalProperties": false
  },
  "metric.create": {
    "type": "object",
    "required": [
      "configuration"
    ],
    "properties": {
      "configuration": {
        "type": "object",
        "required": [
          "aggregation",
          "archived",
          "description",
          "freshnessSeconds",
          "key",
          "kind",
          "paused",
          "precision",
          "ratioScale",
          "title",
          "unit",
          "writers"
        ],
        "properties": {
          "aggregation": {
            "type": "string",
            "enum": [
              "Latest",
              "Sum",
              "Mean",
              "Ratio"
            ]
          },
          "archived": {
            "type": "boolean"
          },
          "description": {
            "type": "string",
            "maxLength": 1200
          },
          "freshnessSeconds": {
            "anyOf": [
              {
                "type": "integer",
                "minimum": 60,
                "maximum": 31536000
              },
              {
                "type": "null"
              }
            ]
          },
          "key": {
            "type": "string",
            "maxLength": 48,
            "pattern": "^[a-z][a-z0-9_-]{0,47}$"
          },
          "kind": {
            "type": "string",
            "enum": [
              "Gauge",
              "Counter",
              "Ratio"
            ]
          },
          "paused": {
            "type": "boolean"
          },
          "precision": {
            "type": "integer",
            "minimum": 0,
            "maximum": 6
          },
          "ratioScale": {
            "type": "integer",
            "minimum": 1,
            "maximum": 100
          },
          "title": {
            "type": "string",
            "minLength": 1,
            "maxLength": 160
          },
          "unit": {
            "type": "string",
            "minLength": 1,
            "maxLength": 24
          },
          "writers": {
            "type": "array",
            "maxItems": 64,
            "uniqueItems": true,
            "items": {
              "type": "string"
            }
          }
        },
        "additionalProperties": false
      }
    },
    "additionalProperties": false
  },
  "metric.goal.create": {
    "type": "object",
    "required": [
      "configuration"
    ],
    "properties": {
      "configuration": {
        "type": "object",
        "required": [
          "archived",
          "coachSignal",
          "comparison",
          "completion",
          "description",
          "metricId",
          "notifyCompleted",
          "paused",
          "target",
          "title",
          "window"
        ],
        "properties": {
          "archived": {
            "type": "boolean"
          },
          "coachSignal": {
            "type": "boolean"
          },
          "comparison": {
            "type": "string",
            "enum": [
              "AtLeast",
              "AtMost"
            ]
          },
          "completion": {
            "type": "string",
            "enum": [
              "OnReach",
              "AtEnd"
            ]
          },
          "description": {
            "type": "string",
            "maxLength": 1200
          },
          "metricId": {
            "type": "string"
          },
          "notifyCompleted": {
            "type": "boolean"
          },
          "paused": {
            "type": "boolean"
          },
          "target": {
            "type": "string",
            "maxLength": 32,
            "pattern": "^-?[0-9]{1,24}(\\.[0-9]{1,6})?$"
          },
          "title": {
            "type": "string",
            "minLength": 1,
            "maxLength": 160
          },
          "window": {
            "anyOf": [
              {
                "type": "object",
                "required": [
                  "end",
                  "start"
                ],
                "properties": {
                  "end": {
                    "type": "string"
                  },
                  "start": {
                    "type": "string"
                  }
                },
                "additionalProperties": false
              },
              {
                "type": "null"
              }
            ]
          }
        },
        "additionalProperties": false
      }
    },
    "additionalProperties": false
  },
  "metric.goal.update": {
    "type": "object",
    "required": [
      "configuration"
    ],
    "properties": {
      "configuration": {
        "type": "object",
        "required": [
          "archived",
          "coachSignal",
          "comparison",
          "completion",
          "description",
          "metricId",
          "notifyCompleted",
          "paused",
          "target",
          "title",
          "window"
        ],
        "properties": {
          "archived": {
            "type": "boolean"
          },
          "coachSignal": {
            "type": "boolean"
          },
          "comparison": {
            "type": "string",
            "enum": [
              "AtLeast",
              "AtMost"
            ]
          },
          "completion": {
            "type": "string",
            "enum": [
              "OnReach",
              "AtEnd"
            ]
          },
          "description": {
            "type": "string",
            "maxLength": 1200
          },
          "metricId": {
            "type": "string"
          },
          "notifyCompleted": {
            "type": "boolean"
          },
          "paused": {
            "type": "boolean"
          },
          "target": {
            "type": "string",
            "maxLength": 32,
            "pattern": "^-?[0-9]{1,24}(\\.[0-9]{1,6})?$"
          },
          "title": {
            "type": "string",
            "minLength": 1,
            "maxLength": 160
          },
          "window": {
            "anyOf": [
              {
                "type": "object",
                "required": [
                  "end",
                  "start"
                ],
                "properties": {
                  "end": {
                    "type": "string"
                  },
                  "start": {
                    "type": "string"
                  }
                },
                "additionalProperties": false
              },
              {
                "type": "null"
              }
            ]
          }
        },
        "additionalProperties": false
      }
    },
    "additionalProperties": false
  },
  "metric.record": {
    "type": "object",
    "required": [
      "measurement",
      "measurementVersion",
      "metricId",
      "observedAt",
      "sourceKey",
      "sourceLabel"
    ],
    "properties": {
      "metricId": {
        "type": "string"
      },
      "measurementVersion": {
        "type": "integer",
        "minimum": 1
      },
      "sourceKey": {
        "type": "string",
        "minLength": 1,
        "maxLength": 160
      },
      "sourceLabel": {
        "type": "string",
        "minLength": 1,
        "maxLength": 120
      },
      "observedAt": {
        "type": "string"
      },
      "measurement": {
        "type": "object",
        "required": [
          "denominator",
          "numerator",
          "value"
        ],
        "properties": {
          "denominator": {
            "anyOf": [
              {
                "type": "number",
                "minimum": 0,
                "maximum": 1000000000
              },
              {
                "type": "null"
              }
            ]
          },
          "numerator": {
            "anyOf": [
              {
                "type": "number",
                "minimum": 0,
                "maximum": 1000000000
              },
              {
                "type": "null"
              }
            ]
          },
          "value": {
            "anyOf": [
              {
                "type": "number",
                "minimum": -1000000000,
                "maximum": 1000000000
              },
              {
                "type": "null"
              }
            ]
          }
        },
        "additionalProperties": false
      }
    },
    "additionalProperties": false
  },
  "metric.update": {
    "type": "object",
    "required": [
      "configuration"
    ],
    "properties": {
      "configuration": {
        "type": "object",
        "required": [
          "aggregation",
          "archived",
          "description",
          "freshnessSeconds",
          "key",
          "kind",
          "paused",
          "precision",
          "ratioScale",
          "title",
          "unit",
          "writers"
        ],
        "properties": {
          "aggregation": {
            "type": "string",
            "enum": [
              "Latest",
              "Sum",
              "Mean",
              "Ratio"
            ]
          },
          "archived": {
            "type": "boolean"
          },
          "description": {
            "type": "string",
            "maxLength": 1200
          },
          "freshnessSeconds": {
            "anyOf": [
              {
                "type": "integer",
                "minimum": 60,
                "maximum": 31536000
              },
              {
                "type": "null"
              }
            ]
          },
          "key": {
            "type": "string",
            "maxLength": 48,
            "pattern": "^[a-z][a-z0-9_-]{0,47}$"
          },
          "kind": {
            "type": "string",
            "enum": [
              "Gauge",
              "Counter",
              "Ratio"
            ]
          },
          "paused": {
            "type": "boolean"
          },
          "precision": {
            "type": "integer",
            "minimum": 0,
            "maximum": 6
          },
          "ratioScale": {
            "type": "integer",
            "minimum": 1,
            "maximum": 100
          },
          "title": {
            "type": "string",
            "minLength": 1,
            "maxLength": 160
          },
          "unit": {
            "type": "string",
            "minLength": 1,
            "maxLength": 24
          },
          "writers": {
            "type": "array",
            "maxItems": 64,
            "uniqueItems": true,
            "items": {
              "type": "string"
            }
          }
        },
        "additionalProperties": false
      }
    },
    "additionalProperties": false
  },
  "metric.void": {
    "type": "object",
    "required": [
      "reason"
    ],
    "properties": {
      "reason": {
        "type": "string",
        "minLength": 1,
        "maxLength": 500
      }
    },
    "additionalProperties": false
  },
  "protocol.apply": {
    "type": "object",
    "required": [
      "count",
      "digest",
      "from"
    ],
    "properties": {
      "digest": {
        "type": "string",
        "maxLength": 64,
        "pattern": "^[a-f0-9]{64}$"
      },
      "from": {
        "type": "integer",
        "minimum": 0,
        "maximum": 199
      },
      "count": {
        "type": "integer",
        "minimum": 1,
        "maximum": 20
      }
    },
    "additionalProperties": false
  },
  "protocol.cancel": {
    "type": "object",
    "required": [],
    "properties": {},
    "additionalProperties": false
  },
  "protocol.publish": {
    "type": "object",
    "required": [
      "definition",
      "previousVersionId"
    ],
    "properties": {
      "definition": {
        "type": "object",
        "required": [
          "description",
          "formatVersion",
          "name",
          "steps",
          "variables"
        ],
        "properties": {
          "description": {
            "type": "string",
            "maxLength": 1000
          },
          "formatVersion": {
            "type": "integer",
            "minimum": 1,
            "maximum": 1
          },
          "name": {
            "type": "string",
            "minLength": 1,
            "maxLength": 160
          },
          "steps": {
            "type": "array",
            "minItems": 1,
            "maxItems": 200,
            "items": {
              "type": "object",
              "required": [
                "acceptance",
                "delivery",
                "dependencies",
                "description",
                "dueAfterDays",
                "importance",
                "importanceReason",
                "key",
                "kind",
                "ownerVariable",
                "parent",
                "title"
              ],
              "properties": {
                "acceptance": {
                  "type": "array",
                  "minItems": 1,
                  "maxItems": 10,
                  "items": {
                    "type": "string"
                  }
                },
                "delivery": {
                  "type": "object",
                  "required": [
                    "animation",
                    "push",
                    "recap"
                  ],
                  "properties": {
                    "animation": {
                      "type": "string",
                      "enum": [
                        "inherit",
                        "silent",
                        "request"
                      ]
                    },
                    "push": {
                      "type": "string",
                      "enum": [
                        "inherit",
                        "silent",
                        "request"
                      ]
                    },
                    "recap": {
                      "type": "boolean"
                    }
                  },
                  "additionalProperties": false
                },
                "dependencies": {
                  "type": "array",
                  "maxItems": 20,
                  "uniqueItems": true,
                  "items": {
                    "type": "string"
                  }
                },
                "description": {
                  "type": "string",
                  "maxLength": 600
                },
                "dueAfterDays": {
                  "anyOf": [
                    {
                      "type": "integer",
                      "minimum": 0,
                      "maximum": 3650
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "estimateDays": {
                  "anyOf": [
                    {
                      "type": "number",
                      "minimum": 0.1,
                      "maximum": 60
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "importance": {
                  "type": "string",
                  "enum": [
                    "Minor",
                    "Normal",
                    "Important",
                    "Critical"
                  ]
                },
                "importanceReason": {
                  "type": "string",
                  "maxLength": 400
                },
                "key": {
                  "type": "string",
                  "maxLength": 48,
                  "pattern": "^[a-z][a-z0-9_-]{0,47}$"
                },
                "kind": {
                  "type": "string",
                  "enum": [
                    "Ticket",
                    "Epic",
                    "Subtask"
                  ]
                },
                "ownerVariable": {
                  "anyOf": [
                    {
                      "type": "string",
                      "maxLength": 48
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "parent": {
                  "anyOf": [
                    {
                      "type": "string",
                      "maxLength": 48
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "title": {
                  "type": "string",
                  "minLength": 3,
                  "maxLength": 200
                }
              },
              "additionalProperties": false
            }
          },
          "variables": {
            "type": "array",
            "maxItems": 24,
            "items": {
              "type": "object",
              "required": [
                "key",
                "kind",
                "label",
                "required"
              ],
              "properties": {
                "defaultValue": {},
                "key": {
                  "type": "string",
                  "maxLength": 48,
                  "pattern": "^[a-z][a-z0-9_-]{0,47}$"
                },
                "kind": {
                  "type": "string",
                  "enum": [
                    "text",
                    "number",
                    "boolean",
                    "user",
                    "date"
                  ]
                },
                "label": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 120
                },
                "required": {
                  "type": "boolean"
                }
              },
              "additionalProperties": false
            }
          }
        },
        "additionalProperties": false
      },
      "previousVersionId": {
        "anyOf": [
          {
            "type": "string",
            "maxLength": 36
          },
          {
            "type": "null"
          }
        ]
      }
    },
    "additionalProperties": false
  },
  "protocol.start": {
    "type": "object",
    "required": [
      "bindings",
      "protocolVersionId"
    ],
    "properties": {
      "protocolVersionId": {
        "type": "string",
        "maxLength": 36
      },
      "bindings": {
        "type": "object",
        "required": [
          "anchor",
          "epoch",
          "instanceId",
          "scope",
          "values"
        ],
        "properties": {
          "anchor": {
            "type": "string"
          },
          "epoch": {
            "type": "string",
            "minLength": 1,
            "maxLength": 128
          },
          "instanceId": {
            "type": "string",
            "maxLength": 36,
            "pattern": "^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$"
          },
          "scope": {
            "type": "string",
            "maxLength": 128,
            "pattern": "^project:[A-Za-z0-9_-]+$"
          },
          "values": {
            "type": "object",
            "maxProperties": 24,
            "additionalProperties": {}
          }
        },
        "additionalProperties": false
      }
    },
    "additionalProperties": false
  },
  "run.checkpoint": {
    "type": "object",
    "required": [
      "state",
      "summary"
    ],
    "properties": {
      "state": {
        "type": "string",
        "enum": [
          "Working",
          "Waiting",
          "NeedsReview"
        ]
      },
      "summary": {
        "type": "string",
        "minLength": 1,
        "maxLength": 2000
      },
      "nextSteps": {
        "type": "string",
        "maxLength": 4000
      },
      "evidence": {
        "type": "array",
        "maxItems": 8,
        "items": {
          "type": "object",
          "required": [
            "label",
            "url"
          ],
          "properties": {
            "label": {
              "type": "string",
              "minLength": 1,
              "maxLength": 120
            },
            "url": {
              "type": "string",
              "minLength": 1,
              "maxLength": 2048
            }
          },
          "additionalProperties": false
        }
      },
      "leaseSeconds": {
        "type": "integer",
        "minimum": 60,
        "maximum": 900
      }
    },
    "additionalProperties": false
  },
  "run.claim": {
    "type": "object",
    "required": [
      "summary",
      "task",
      "taskRevision"
    ],
    "properties": {
      "task": {
        "type": "string",
        "minLength": 1,
        "maxLength": 128
      },
      "taskRevision": {
        "type": "string",
        "minLength": 1,
        "maxLength": 40
      },
      "summary": {
        "type": "string",
        "minLength": 1,
        "maxLength": 2000
      },
      "leaseSeconds": {
        "type": "integer",
        "minimum": 60,
        "maximum": 900
      }
    },
    "additionalProperties": false
  },
  "run.finish": {
    "type": "object",
    "required": [
      "state",
      "summary"
    ],
    "properties": {
      "state": {
        "type": "string",
        "enum": [
          "Completed",
          "Failed",
          "Cancelled"
        ]
      },
      "summary": {
        "type": "string",
        "minLength": 1,
        "maxLength": 2000
      },
      "nextSteps": {
        "type": "string",
        "maxLength": 4000
      },
      "evidence": {
        "type": "array",
        "maxItems": 8,
        "items": {
          "type": "object",
          "required": [
            "label",
            "url"
          ],
          "properties": {
            "label": {
              "type": "string",
              "minLength": 1,
              "maxLength": 120
            },
            "url": {
              "type": "string",
              "minLength": 1,
              "maxLength": 2048
            }
          },
          "additionalProperties": false
        }
      }
    },
    "additionalProperties": false
  },
  "run.lock": {
    "type": "object",
    "required": [
      "reason",
      "taskRevision"
    ],
    "properties": {
      "taskRevision": {
        "type": "string",
        "minLength": 1,
        "maxLength": 40
      },
      "reason": {
        "type": "string",
        "minLength": 1,
        "maxLength": 500
      }
    },
    "additionalProperties": false
  },
  "run.patch": {
    "type": "object",
    "required": [
      "patch",
      "taskRevision"
    ],
    "properties": {
      "taskRevision": {
        "type": "string",
        "minLength": 1,
        "maxLength": 40
      },
      "patch": {
        "type": "object",
        "additionalProperties": {}
      }
    },
    "additionalProperties": false
  },
  "run.unlock": {
    "type": "object",
    "required": [
      "taskRevision"
    ],
    "properties": {
      "taskRevision": {
        "type": "string",
        "minLength": 1,
        "maxLength": 40
      }
    },
    "additionalProperties": false
  },
  "task.create": {
    "type": "object",
    "required": [
      "title"
    ],
    "properties": {
      "title": {
        "type": "string",
        "description": "Task title, 3 through 200 characters after server trimming. Required on creation.",
        "minLength": 3,
        "maxLength": 200
      },
      "description": {
        "anyOf": [
          {
            "type": "string",
            "description": "Optional short description, at most 600 characters. Omission preserves existing content on update; null clears it.",
            "maxLength": 600
          },
          {
            "type": "null"
          }
        ]
      },
      "importance": {
        "anyOf": [
          {
            "type": "string",
            "enum": [
              "Minor",
              "Normal",
              "Important",
              "Critical"
            ],
            "description": "Impact, independent of urgency or task type. New tasks default to Normal. Important/Critical require a useful importanceReason. An agent cannot replace a human-owned classification; null follows the existing Normal fallback."
          },
          {
            "type": "null"
          }
        ]
      },
      "importanceReason": {
        "anyOf": [
          {
            "type": "string",
            "description": "Explanation of impact, trimmed by the server, at most 400 characters. Important/Critical require a nonempty reason. Omission preserves the saved explanation; null or empty clears it subject to current importance rules.",
            "maxLength": 400
          },
          {
            "type": "null"
          }
        ]
      },
      "type": {
        "anyOf": [
          {
            "type": "string",
            "enum": [
              "Task",
              "Critical",
              "NewFeature",
              "Question"
            ],
            "description": "Task classification. New tasks default to Task. Critical here is a task type, not an importance estimate; null retains existing schema compatibility."
          },
          {
            "type": "null"
          }
        ]
      },
      "owner": {
        "anyOf": [
          {
            "type": "string",
            "description": "Existing approved project member user ID, or null for unassigned. The server may assign the creator when their task-edit rights are limited to owned tasks. Omission preserves the owner on update."
          },
          {
            "type": "null"
          }
        ]
      },
      "status": {
        "anyOf": [
          {
            "type": "string",
            "enum": [
              "New",
              "InProgress",
              "Done"
            ],
            "description": "Actual canonical progress: New means to do, InProgress means work has started, Done requires verified intended completion. New tasks default to New. Domain dependency, hierarchy and permission rules still apply. Null is accepted by the existing task schema but does not establish a known progress state. No Locked value belongs to this field."
          },
          {
            "type": "null"
          }
        ]
      },
      "enableDueDate": {
        "type": "boolean",
        "description": "Enable the separately supplied deadline. New tasks default to false; an effort estimate does not select or enable a deadline."
      },
      "dueDate": {
        "anyOf": [
          {
            "type": "string",
            "description": "Deadline as an ISO date-time, from 2000-01-01 inclusive to 2100-01-01 exclusive, or null to clear it. Supply an explicit timezone. Omission preserves the existing date."
          },
          {
            "type": "null"
          }
        ]
      },
      "estimateDays": {
        "anyOf": [
          {
            "type": "number",
            "description": "Approximate effort in working days: 0.1 is one tenth and 1 is one working day. Finite 0.1 through 60, or null for unknown. Not elapsed time, a deadline, or AI runtime. Omission preserves the current estimate; preserve human estimates unless revising them is authorized.",
            "minimum": 0.1,
            "maximum": 60
          },
          {
            "type": "null"
          }
        ]
      },
      "quantity": {
        "anyOf": [
          {
            "type": "number",
            "description": "Optional nonnegative task quantity, independent of working-day effort. Omission preserves the current quantity; null clears it.",
            "minimum": 0
          },
          {
            "type": "null"
          }
        ]
      },
      "quantityUnit": {
        "anyOf": [
          {
            "type": "string",
            "description": "Optional quantity unit, trimmed by the server, at most 20 characters. Omission preserves it; null clears it.",
            "maxLength": 20
          },
          {
            "type": "null"
          }
        ]
      },
      "autoArchive": {
        "type": "boolean",
        "description": "Whether completed tasks may be archived by the existing schedule. New tasks default to false. This does not complete or immediately archive a task."
      },
      "autoArchiveDays": {
        "type": "integer",
        "description": "Day component of the existing automatic archive delay, integer 0 through 31. New tasks default to 14.",
        "minimum": 0,
        "maximum": 31
      },
      "autoArchiveHours": {
        "type": "integer",
        "description": "Hour component of the existing automatic archive delay, integer 0 through 24. New tasks default to 0.",
        "minimum": 0,
        "maximum": 24
      },
      "dependencies": {
        "anyOf": [
          {
            "type": "array",
            "description": "Prerequisite task IDs from this project, at most 1000. Omission preserves the list; null or [] clears it. The server validates live references, self-links and cycles and removes duplicate IDs. Do not remove dependencies to bypass blocked work.",
            "maxItems": 1000,
            "items": {
              "type": "string"
            }
          },
          {
            "type": "null"
          }
        ]
      },
      "tags": {
        "anyOf": [
          {
            "type": "array",
            "description": "Existing project tag IDs, at most 50. Omission preserves the list; null or [] clears it. The server validates same-project references and removes duplicate IDs.",
            "maxItems": 50,
            "items": {
              "type": "string"
            }
          },
          {
            "type": "null"
          }
        ]
      }
    },
    "additionalProperties": false
  },
  "task.lock": {
    "type": "object",
    "required": [
      "reason"
    ],
    "properties": {
      "reason": {
        "type": "string",
        "minLength": 1,
        "maxLength": 500
      }
    },
    "additionalProperties": false
  },
  "task.unlock": {
    "type": "object",
    "properties": {},
    "additionalProperties": false,
    "required": []
  },
  "task.update": {
    "type": "object",
    "properties": {
      "title": {
        "type": "string",
        "description": "Replacement task title, 3 through 200 characters after server trimming. Omission preserves the saved title; null is not a valid title.",
        "minLength": 3,
        "maxLength": 200
      },
      "description": {
        "anyOf": [
          {
            "type": "string",
            "description": "Optional short description, at most 600 characters. Omission preserves existing content on update; null clears it.",
            "maxLength": 600
          },
          {
            "type": "null"
          }
        ]
      },
      "importance": {
        "anyOf": [
          {
            "type": "string",
            "enum": [
              "Minor",
              "Normal",
              "Important",
              "Critical"
            ],
            "description": "Impact, independent of urgency or task type. New tasks default to Normal. Important/Critical require a useful importanceReason. An agent cannot replace a human-owned classification; null follows the existing Normal fallback."
          },
          {
            "type": "null"
          }
        ]
      },
      "importanceReason": {
        "anyOf": [
          {
            "type": "string",
            "description": "Explanation of impact, trimmed by the server, at most 400 characters. Important/Critical require a nonempty reason. Omission preserves the saved explanation; null or empty clears it subject to current importance rules.",
            "maxLength": 400
          },
          {
            "type": "null"
          }
        ]
      },
      "type": {
        "anyOf": [
          {
            "type": "string",
            "enum": [
              "Task",
              "Critical",
              "NewFeature",
              "Question"
            ],
            "description": "Task classification. New tasks default to Task. Critical here is a task type, not an importance estimate; null retains existing schema compatibility."
          },
          {
            "type": "null"
          }
        ]
      },
      "owner": {
        "anyOf": [
          {
            "type": "string",
            "description": "Existing approved project member user ID, or null for unassigned. The server may assign the creator when their task-edit rights are limited to owned tasks. Omission preserves the owner on update."
          },
          {
            "type": "null"
          }
        ]
      },
      "status": {
        "anyOf": [
          {
            "type": "string",
            "enum": [
              "New",
              "InProgress",
              "Done"
            ],
            "description": "Actual canonical progress: New means to do, InProgress means work has started, Done requires verified intended completion. New tasks default to New. Domain dependency, hierarchy and permission rules still apply. Null is accepted by the existing task schema but does not establish a known progress state. No Locked value belongs to this field."
          },
          {
            "type": "null"
          }
        ]
      },
      "enableDueDate": {
        "type": "boolean",
        "description": "Enable the separately supplied deadline. New tasks default to false; an effort estimate does not select or enable a deadline."
      },
      "dueDate": {
        "anyOf": [
          {
            "type": "string",
            "description": "Deadline as an ISO date-time, from 2000-01-01 inclusive to 2100-01-01 exclusive, or null to clear it. Supply an explicit timezone. Omission preserves the existing date."
          },
          {
            "type": "null"
          }
        ]
      },
      "estimateDays": {
        "anyOf": [
          {
            "type": "number",
            "description": "Approximate effort in working days: 0.1 is one tenth and 1 is one working day. Finite 0.1 through 60, or null for unknown. Not elapsed time, a deadline, or AI runtime. Omission preserves the current estimate; preserve human estimates unless revising them is authorized.",
            "minimum": 0.1,
            "maximum": 60
          },
          {
            "type": "null"
          }
        ]
      },
      "quantity": {
        "anyOf": [
          {
            "type": "number",
            "description": "Optional nonnegative task quantity, independent of working-day effort. Omission preserves the current quantity; null clears it.",
            "minimum": 0
          },
          {
            "type": "null"
          }
        ]
      },
      "quantityUnit": {
        "anyOf": [
          {
            "type": "string",
            "description": "Optional quantity unit, trimmed by the server, at most 20 characters. Omission preserves it; null clears it.",
            "maxLength": 20
          },
          {
            "type": "null"
          }
        ]
      },
      "autoArchive": {
        "type": "boolean",
        "description": "Whether completed tasks may be archived by the existing schedule. New tasks default to false. This does not complete or immediately archive a task."
      },
      "autoArchiveDays": {
        "type": "integer",
        "description": "Day component of the existing automatic archive delay, integer 0 through 31. New tasks default to 14.",
        "minimum": 0,
        "maximum": 31
      },
      "autoArchiveHours": {
        "type": "integer",
        "description": "Hour component of the existing automatic archive delay, integer 0 through 24. New tasks default to 0.",
        "minimum": 0,
        "maximum": 24
      },
      "dependencies": {
        "anyOf": [
          {
            "type": "array",
            "description": "Prerequisite task IDs from this project, at most 1000. Omission preserves the list; null or [] clears it. The server validates live references, self-links and cycles and removes duplicate IDs. Do not remove dependencies to bypass blocked work.",
            "maxItems": 1000,
            "items": {
              "type": "string"
            }
          },
          {
            "type": "null"
          }
        ]
      },
      "tags": {
        "anyOf": [
          {
            "type": "array",
            "description": "Existing project tag IDs, at most 50. Omission preserves the list; null or [] clears it. The server validates same-project references and removes duplicate IDs.",
            "maxItems": 50,
            "items": {
              "type": "string"
            }
          },
          {
            "type": "null"
          }
        ]
      }
    },
    "additionalProperties": false,
    "required": []
  }
};
