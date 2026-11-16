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
  }
};
