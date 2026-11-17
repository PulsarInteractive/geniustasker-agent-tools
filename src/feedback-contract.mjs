// Generated from public TypeSpec feedback DTOs. Do not edit by hand.
export default {
  "definitions": {
    "GeniusTasker.Feedback.FeedbackType": {
      "enum": [
        "BugReport",
        "FeatureRequest"
      ],
      "type": "string"
    },
    "GeniusTasker.Feedback.FeedbackStatus": {
      "enum": [
        "received",
        "under_review",
        "planned",
        "in_progress",
        "closed"
      ],
      "type": "string"
    },
    "GeniusTasker.Feedback.FeedbackResolution": {
      "enum": [
        "delivered",
        "remembered",
        "duplicate",
        "not_reproduced",
        "declined",
        "spam"
      ],
      "type": "string"
    },
    "GeniusTasker.Feedback.FeedbackCategory": {
      "enum": [
        "projects",
        "tasks",
        "planning",
        "memory",
        "goals",
        "metrics",
        "coach",
        "sync",
        "account",
        "billing",
        "integrations",
        "other"
      ],
      "type": "string"
    },
    "GeniusTasker.Feedback.FeedbackContext": {
      "additionalProperties": false,
      "properties": {
        "appVersion": {
          "anyOf": [
            {
              "maxLength": 40,
              "type": "string"
            },
            {
              "type": "null"
            }
          ]
        },
        "buildNumber": {
          "anyOf": [
            {
              "maxLength": 40,
              "type": "string"
            },
            {
              "type": "null"
            }
          ]
        },
        "errorCode": {
          "anyOf": [
            {
              "maxLength": 120,
              "type": "string"
            },
            {
              "type": "null"
            }
          ]
        },
        "locale": {
          "anyOf": [
            {
              "maxLength": 40,
              "type": "string"
            },
            {
              "type": "null"
            }
          ]
        },
        "platform": {
          "anyOf": [
            {
              "maxLength": 40,
              "type": "string"
            },
            {
              "type": "null"
            }
          ]
        },
        "requestId": {
          "anyOf": [
            {
              "maxLength": 128,
              "type": "string"
            },
            {
              "type": "null"
            }
          ]
        },
        "screen": {
          "anyOf": [
            {
              "maxLength": 160,
              "type": "string"
            },
            {
              "type": "null"
            }
          ]
        }
      },
      "type": "object"
    },
    "GeniusTasker.Feedback.FeedbackImage": {
      "additionalProperties": false,
      "properties": {
        "assetId": {
          "type": "string"
        },
        "contentType": {
          "enum": [
            "image/webp"
          ],
          "type": "string"
        },
        "fileName": {
          "type": "string"
        },
        "height": {
          "format": "int32",
          "type": "integer"
        },
        "readPath": {
          "type": "string"
        },
        "size": {
          "format": "int32",
          "type": "integer"
        },
        "width": {
          "format": "int32",
          "type": "integer"
        }
      },
      "required": [
        "assetId",
        "contentType",
        "fileName",
        "height",
        "readPath",
        "size",
        "width"
      ],
      "type": "object"
    },
    "GeniusTasker.Feedback.FeedbackCapabilities": {
      "additionalProperties": false,
      "properties": {
        "canRead": {
          "type": "boolean"
        },
        "canReply": {
          "type": "boolean"
        },
        "canReportBug": {
          "type": "boolean"
        },
        "canRequestFeature": {
          "type": "boolean"
        },
        "epoch": {
          "type": "string"
        },
        "maxImages": {
          "format": "int32",
          "type": "integer"
        },
        "maxUploadBytes": {
          "format": "int32",
          "type": "integer"
        },
        "unread": {
          "format": "int32",
          "type": "integer"
        }
      },
      "required": [
        "canRead",
        "canReply",
        "canReportBug",
        "canRequestFeature",
        "epoch",
        "maxImages",
        "maxUploadBytes",
        "unread"
      ],
      "type": "object"
    },
    "GeniusTasker.Feedback.FeedbackCreate": {
      "additionalProperties": false,
      "properties": {
        "attachments": {
          "items": {
            "type": "string"
          },
          "maxItems": 3,
          "type": "array",
          "uniqueItems": true
        },
        "category": {
          "$ref": "#/$defs/GeniusTasker.Feedback.FeedbackCategory"
        },
        "commandId": {
          "format": "uuid",
          "type": "string"
        },
        "context": {
          "$ref": "#/$defs/GeniusTasker.Feedback.FeedbackContext"
        },
        "description": {
          "maxLength": 8000,
          "minLength": 1,
          "type": "string"
        },
        "draftId": {
          "format": "uuid",
          "type": "string"
        },
        "expectedEpoch": {
          "maxLength": 128,
          "minLength": 1,
          "type": "string"
        },
        "issuedAt": {
          "format": "int64",
          "minimum": 0,
          "type": "integer"
        },
        "title": {
          "maxLength": 200,
          "minLength": 1,
          "type": "string"
        },
        "type": {
          "$ref": "#/$defs/GeniusTasker.Feedback.FeedbackType"
        }
      },
      "required": [
        "attachments",
        "category",
        "commandId",
        "description",
        "draftId",
        "expectedEpoch",
        "issuedAt",
        "title",
        "type"
      ],
      "type": "object"
    },
    "GeniusTasker.Feedback.FeedbackReceipt": {
      "additionalProperties": false,
      "properties": {
        "commandId": {
          "type": "string"
        },
        "duplicate": {
          "type": "boolean"
        },
        "id": {
          "type": "string"
        },
        "receivedAt": {
          "type": "string"
        }
      },
      "required": [
        "commandId",
        "duplicate",
        "id",
        "receivedAt"
      ],
      "type": "object"
    },
    "GeniusTasker.Feedback.FeedbackSummary": {
      "additionalProperties": false,
      "properties": {
        "category": {
          "$ref": "#/$defs/GeniusTasker.Feedback.FeedbackCategory"
        },
        "createdAt": {
          "type": "string"
        },
        "id": {
          "type": "string"
        },
        "owner": {
          "type": "string"
        },
        "resolution": {
          "anyOf": [
            {
              "$ref": "#/$defs/GeniusTasker.Feedback.FeedbackResolution"
            },
            {
              "type": "null"
            }
          ]
        },
        "revision": {
          "type": "string"
        },
        "source": {
          "oneOf": [
            {
              "enum": [
                "app"
              ],
              "type": "string"
            },
            {
              "enum": [
                "agent"
              ],
              "type": "string"
            }
          ]
        },
        "status": {
          "$ref": "#/$defs/GeniusTasker.Feedback.FeedbackStatus"
        },
        "title": {
          "type": "string"
        },
        "type": {
          "$ref": "#/$defs/GeniusTasker.Feedback.FeedbackType"
        },
        "unread": {
          "type": "boolean"
        },
        "updatedAt": {
          "type": "string"
        }
      },
      "required": [
        "category",
        "createdAt",
        "id",
        "owner",
        "resolution",
        "revision",
        "source",
        "status",
        "title",
        "type",
        "unread",
        "updatedAt"
      ],
      "type": "object"
    },
    "GeniusTasker.Feedback.FeedbackMessage": {
      "additionalProperties": false,
      "properties": {
        "attachments": {
          "items": {
            "$ref": "#/$defs/GeniusTasker.Feedback.FeedbackImage"
          },
          "type": "array"
        },
        "author": {
          "enum": [
            "team"
          ],
          "type": "string"
        },
        "createdAt": {
          "type": "string"
        },
        "id": {
          "type": "string"
        },
        "text": {
          "type": "string"
        }
      },
      "required": [
        "attachments",
        "author",
        "createdAt",
        "id",
        "text"
      ],
      "type": "object"
    },
    "GeniusTasker.Feedback.FeedbackDetail": {
      "additionalProperties": false,
      "properties": {
        "attachments": {
          "items": {
            "$ref": "#/$defs/GeniusTasker.Feedback.FeedbackImage"
          },
          "type": "array"
        },
        "context": {
          "$ref": "#/$defs/GeniusTasker.Feedback.FeedbackContext"
        },
        "description": {
          "type": "string"
        },
        "epoch": {
          "type": "string"
        },
        "messages": {
          "items": {
            "$ref": "#/$defs/GeniusTasker.Feedback.FeedbackMessage"
          },
          "maxItems": 1,
          "type": "array"
        },
        "summary": {
          "$ref": "#/$defs/GeniusTasker.Feedback.FeedbackSummary"
        }
      },
      "required": [
        "attachments",
        "context",
        "description",
        "epoch",
        "messages",
        "summary"
      ],
      "type": "object"
    },
    "GeniusTasker.Feedback.FeedbackPage": {
      "additionalProperties": false,
      "properties": {
        "entries": {
          "items": {
            "$ref": "#/$defs/GeniusTasker.Feedback.FeedbackSummary"
          },
          "type": "array"
        },
        "next": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ]
        }
      },
      "required": [
        "entries",
        "next"
      ],
      "type": "object"
    },
    "GeniusTasker.Feedback.FeedbackMarkRead": {
      "additionalProperties": false,
      "properties": {
        "expectedEpoch": {
          "type": "string"
        },
        "revision": {
          "type": "string"
        }
      },
      "required": [
        "expectedEpoch",
        "revision"
      ],
      "type": "object"
    },
    "GeniusTasker.Feedback.FeedbackUpload": {
      "additionalProperties": false,
      "properties": {
        "contentType": {
          "oneOf": [
            {
              "enum": [
                "image/png"
              ],
              "type": "string"
            },
            {
              "enum": [
                "image/jpeg"
              ],
              "type": "string"
            },
            {
              "enum": [
                "image/webp"
              ],
              "type": "string"
            }
          ]
        },
        "draftId": {
          "format": "uuid",
          "type": "string"
        },
        "expectedEpoch": {
          "maxLength": 128,
          "minLength": 1,
          "type": "string"
        },
        "fileName": {
          "maxLength": 200,
          "minLength": 1,
          "type": "string"
        },
        "height": {
          "format": "int32",
          "maximum": 4096,
          "minimum": 1,
          "type": "integer"
        },
        "id": {
          "format": "uuid",
          "type": "string"
        },
        "issuedAt": {
          "format": "int64",
          "minimum": 0,
          "type": "integer"
        },
        "sha256": {
          "maxLength": 64,
          "pattern": "^[a-f0-9]{64}$",
          "type": "string"
        },
        "size": {
          "format": "int32",
          "maximum": 4000000,
          "minimum": 1,
          "type": "integer"
        },
        "width": {
          "format": "int32",
          "maximum": 4096,
          "minimum": 1,
          "type": "integer"
        }
      },
      "required": [
        "contentType",
        "draftId",
        "expectedEpoch",
        "fileName",
        "height",
        "id",
        "issuedAt",
        "sha256",
        "size",
        "width"
      ],
      "type": "object"
    },
    "GeniusTasker.Feedback.FeedbackMediaSession": {
      "additionalProperties": false,
      "properties": {
        "assetId": {
          "type": "string"
        },
        "draftId": {
          "type": "string"
        },
        "image": {
          "anyOf": [
            {
              "$ref": "#/$defs/GeniusTasker.Feedback.FeedbackImage"
            },
            {
              "type": "null"
            }
          ]
        },
        "state": {
          "oneOf": [
            {
              "enum": [
                "pending"
              ],
              "type": "string"
            },
            {
              "enum": [
                "ready"
              ],
              "type": "string"
            }
          ]
        },
        "uploadPath": {
          "type": "string"
        }
      },
      "required": [
        "assetId",
        "draftId",
        "image",
        "state",
        "uploadPath"
      ],
      "type": "object"
    }
  }
};
