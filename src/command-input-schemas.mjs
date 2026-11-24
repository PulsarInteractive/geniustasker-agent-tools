// Generated public command data schemas. Do not edit by hand.
export default {
  "checklist.create": {
    "type": "object",
    "required": [
      "task",
      "title"
    ],
    "properties": {
      "task": {
        "type": "string",
        "minLength": 1,
        "maxLength": 128
      },
      "title": {
        "type": "string",
        "minLength": 1,
        "maxLength": 240
      },
      "sectionId": {
        "anyOf": [
          {
            "type": "string",
            "pattern": "^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$"
          },
          {
            "type": "null"
          }
        ]
      }
    },
    "additionalProperties": false
  },
  "checklist.move": {
    "type": "object",
    "required": [
      "neighborId",
      "neighborRevision",
      "task"
    ],
    "properties": {
      "task": {
        "type": "string",
        "minLength": 1,
        "maxLength": 128
      },
      "neighborId": {
        "type": "string",
        "minLength": 1,
        "maxLength": 128
      },
      "neighborRevision": {
        "type": "string",
        "minLength": 1,
        "maxLength": 40
      }
    },
    "additionalProperties": false
  },
  "checklist.remove": {
    "type": "object",
    "required": [
      "task"
    ],
    "properties": {
      "task": {
        "type": "string",
        "minLength": 1,
        "maxLength": 128
      }
    },
    "additionalProperties": false
  },
  "checklist.update": {
    "type": "object",
    "required": [
      "task"
    ],
    "properties": {
      "task": {
        "type": "string",
        "minLength": 1,
        "maxLength": 128
      },
      "title": {
        "type": "string",
        "minLength": 1,
        "maxLength": 240
      },
      "checked": {
        "type": "boolean"
      }
    },
    "additionalProperties": false
  },
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
  "memory.design.pruneRevision": {
    "type": "object",
    "required": [
      "confirmed",
      "currentRevision",
      "revision",
      "variantId"
    ],
    "properties": {
      "variantId": {
        "type": "string",
        "pattern": "^[a-zA-Z0-9_-]{1,128}$"
      },
      "revision": {
        "type": "string",
        "pattern": "^[1-9][0-9]{0,15}$"
      },
      "currentRevision": {
        "type": "string",
        "pattern": "^[1-9][0-9]{0,15}$"
      },
      "confirmed": {
        "type": "boolean",
        "enum": [
          true
        ]
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
  "project.configureDocumentation": {
    "type": "object",
    "required": [
      "documentation"
    ],
    "properties": {
      "documentation": {
        "type": "object",
        "required": [
          "autoDomains",
          "folderId",
          "guidance",
          "language",
          "memoryId",
          "stylePageId",
          "suggestionState"
        ],
        "properties": {
          "autoDomains": {
            "type": "array",
            "maxItems": 24,
            "uniqueItems": true,
            "items": {
              "type": "string"
            }
          },
          "folderId": {
            "anyOf": [
              {
                "type": "string",
                "pattern": "^[a-zA-Z0-9_-]{1,128}$"
              },
              {
                "type": "null"
              }
            ]
          },
          "guidance": {
            "type": "string",
            "maxLength": 4000
          },
          "language": {
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
          "memoryId": {
            "anyOf": [
              {
                "type": "string",
                "pattern": "^[a-zA-Z0-9_-]{1,128}$"
              },
              {
                "type": "null"
              }
            ]
          },
          "stylePageId": {
            "anyOf": [
              {
                "type": "string",
                "pattern": "^[a-zA-Z0-9_-]{1,128}$"
              },
              {
                "type": "null"
              }
            ]
          },
          "suggestionState": {
            "oneOf": [
              {
                "type": "string",
                "enum": [
                  "ask"
                ]
              },
              {
                "type": "string",
                "enum": [
                  "later"
                ]
              },
              {
                "type": "string",
                "enum": [
                  "dismissed"
                ]
              }
            ]
          }
        },
        "additionalProperties": false
      }
    },
    "additionalProperties": false
  },
  "project.configureInstructions": {
    "type": "object",
    "required": [
      "instructions"
    ],
    "properties": {
      "instructions": {
        "type": "string",
        "maxLength": 12000,
        "pattern": "^[^\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f]*$"
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
                    "reason": {
                      "anyOf": [
                        {
                          "type": "string",
                          "maxLength": 240
                        },
                        {
                          "type": "null"
                        }
                      ]
                    },
                    "recap": {
                      "type": "boolean"
                    },
                    "score": {
                      "anyOf": [
                        {
                          "type": "integer",
                          "minimum": 0,
                          "maximum": 100
                        },
                        {
                          "type": "null"
                        }
                      ]
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
  "run.checklist": {
    "type": "object",
    "required": [
      "change",
      "itemId",
      "itemRevision",
      "taskRevision"
    ],
    "properties": {
      "taskRevision": {
        "type": "string",
        "minLength": 1,
        "maxLength": 40
      },
      "itemId": {
        "type": "string",
        "minLength": 36,
        "maxLength": 36
      },
      "itemRevision": {
        "anyOf": [
          {
            "type": "string",
            "minLength": 1,
            "maxLength": 40
          },
          {
            "type": "null"
          }
        ]
      },
      "change": {
        "oneOf": [
          {
            "type": "object",
            "required": [
              "action",
              "task",
              "title"
            ],
            "properties": {
              "action": {
                "type": "string",
                "enum": [
                  "createChecklistItem"
                ]
              },
              "sectionId": {
                "anyOf": [
                  {
                    "type": "string",
                    "pattern": "^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$"
                  },
                  {
                    "type": "null"
                  }
                ]
              },
              "task": {
                "type": "string",
                "minLength": 1,
                "maxLength": 128
              },
              "title": {
                "type": "string",
                "minLength": 1,
                "maxLength": 240
              }
            },
            "additionalProperties": false
          },
          {
            "type": "object",
            "required": [
              "action",
              "task"
            ],
            "properties": {
              "action": {
                "type": "string",
                "enum": [
                  "updateChecklistItem"
                ]
              },
              "checked": {
                "type": "boolean"
              },
              "task": {
                "type": "string",
                "minLength": 1,
                "maxLength": 128
              },
              "title": {
                "type": "string",
                "minLength": 1,
                "maxLength": 240
              }
            },
            "additionalProperties": false
          },
          {
            "type": "object",
            "required": [
              "action",
              "neighborId",
              "neighborRevision",
              "task"
            ],
            "properties": {
              "action": {
                "type": "string",
                "enum": [
                  "moveChecklistItem"
                ]
              },
              "neighborId": {
                "type": "string",
                "minLength": 1,
                "maxLength": 128
              },
              "neighborRevision": {
                "type": "string",
                "minLength": 1,
                "maxLength": 40
              },
              "task": {
                "type": "string",
                "minLength": 1,
                "maxLength": 128
              }
            },
            "additionalProperties": false
          },
          {
            "type": "object",
            "required": [
              "action",
              "task"
            ],
            "properties": {
              "action": {
                "type": "string",
                "enum": [
                  "removeChecklistItem"
                ]
              },
              "task": {
                "type": "string",
                "minLength": 1,
                "maxLength": 128
              }
            },
            "additionalProperties": false
          }
        ]
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
  "run.pause": {
    "type": "object",
    "required": [
      "nextSteps",
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
      },
      "nextSteps": {
        "type": "string",
        "minLength": 1,
        "maxLength": 2000
      }
    },
    "additionalProperties": false
  },
  "run.resume": {
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
      "contentReferences": {
        "anyOf": [
          {
            "type": "array",
            "maxItems": 12,
            "items": {
              "type": "object",
              "required": [
                "kind",
                "pageId",
                "scope"
              ],
              "properties": {
                "atMs": {
                  "anyOf": [
                    {
                      "type": "integer",
                      "minimum": 0,
                      "maximum": 86400000
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "blockId": {
                  "anyOf": [
                    {
                      "type": "string",
                      "pattern": "^[a-zA-Z0-9_-]{1,80}$"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "criterionId": {
                  "anyOf": [
                    {
                      "type": "string",
                      "pattern": "^(global|page):[a-z0-9_-]{1,48}$"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "kind": {
                  "type": "string",
                  "pattern": "^(guide|design|skill)$"
                },
                "pageId": {
                  "type": "string",
                  "pattern": "^[a-zA-Z0-9_-]{1,128}$"
                },
                "revision": {
                  "anyOf": [
                    {
                      "type": "string",
                      "pattern": "^[1-9][0-9]{0,15}$"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "scope": {
                  "type": "string",
                  "pattern": "^memory:[a-zA-Z0-9_-]{1,128}$"
                }
              },
              "additionalProperties": false
            }
          },
          {
            "type": "null"
          }
        ]
      },
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
      "completionDelivery": {
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
          "reason": {
            "anyOf": [
              {
                "type": "string",
                "maxLength": 240
              },
              {
                "type": "null"
              }
            ]
          },
          "recap": {
            "type": "boolean"
          },
          "score": {
            "anyOf": [
              {
                "type": "integer",
                "minimum": 0,
                "maximum": 100
              },
              {
                "type": "null"
              }
            ]
          }
        },
        "additionalProperties": false
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
              "Paused",
              "Done"
            ],
            "description": "Actual canonical progress: New means to do, InProgress means identifiable work is currently executing, Paused means a known interruption with a saved reason and next steps, Done requires verified intended completion. Use task.pause/task.resume or the live run equivalents for pause transitions; a status patch cannot pause or resume. New tasks default to New. Domain dependency, hierarchy and permission rules still apply. Null is accepted by the existing task schema but does not establish a known progress state. No Locked value belongs to this field."
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
  "task.pause": {
    "type": "object",
    "required": [
      "nextSteps",
      "reason"
    ],
    "properties": {
      "reason": {
        "type": "string",
        "description": "Observed reason why active work is being paused. This is not a dependency lock.",
        "minLength": 1,
        "maxLength": 500
      },
      "nextSteps": {
        "type": "string",
        "description": "Concrete next action and useful context for resuming the existing work.",
        "minLength": 1,
        "maxLength": 2000
      }
    },
    "additionalProperties": false
  },
  "task.resume": {
    "type": "object",
    "properties": {},
    "additionalProperties": false,
    "required": []
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
      "contentReferences": {
        "anyOf": [
          {
            "type": "array",
            "maxItems": 12,
            "items": {
              "type": "object",
              "required": [
                "kind",
                "pageId",
                "scope"
              ],
              "properties": {
                "atMs": {
                  "anyOf": [
                    {
                      "type": "integer",
                      "minimum": 0,
                      "maximum": 86400000
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "blockId": {
                  "anyOf": [
                    {
                      "type": "string",
                      "pattern": "^[a-zA-Z0-9_-]{1,80}$"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "criterionId": {
                  "anyOf": [
                    {
                      "type": "string",
                      "pattern": "^(global|page):[a-z0-9_-]{1,48}$"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "kind": {
                  "type": "string",
                  "pattern": "^(guide|design|skill)$"
                },
                "pageId": {
                  "type": "string",
                  "pattern": "^[a-zA-Z0-9_-]{1,128}$"
                },
                "revision": {
                  "anyOf": [
                    {
                      "type": "string",
                      "pattern": "^[1-9][0-9]{0,15}$"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "scope": {
                  "type": "string",
                  "pattern": "^memory:[a-zA-Z0-9_-]{1,128}$"
                }
              },
              "additionalProperties": false
            }
          },
          {
            "type": "null"
          }
        ]
      },
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
      "completionDelivery": {
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
          "reason": {
            "anyOf": [
              {
                "type": "string",
                "maxLength": 240
              },
              {
                "type": "null"
              }
            ]
          },
          "recap": {
            "type": "boolean"
          },
          "score": {
            "anyOf": [
              {
                "type": "integer",
                "minimum": 0,
                "maximum": 100
              },
              {
                "type": "null"
              }
            ]
          }
        },
        "additionalProperties": false
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
              "Paused",
              "Done"
            ],
            "description": "Actual canonical progress: New means to do, InProgress means identifiable work is currently executing, Paused means a known interruption with a saved reason and next steps, Done requires verified intended completion. Use task.pause/task.resume or the live run equivalents for pause transitions; a status patch cannot pause or resume. New tasks default to New. Domain dependency, hierarchy and permission rules still apply. Null is accepted by the existing task schema but does not establish a known progress state. No Locked value belongs to this field."
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
