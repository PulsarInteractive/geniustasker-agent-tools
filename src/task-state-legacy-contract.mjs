// Generated public task availability schema. Do not edit by hand.
export default {
  "type": "object",
  "required": [
    "blockersTruncated",
    "blockingIds",
    "dependencyCount",
    "incomplete",
    "manualReason",
    "progress",
    "source",
    "status"
  ],
  "properties": {
    "blockersTruncated": {
      "type": "boolean"
    },
    "blockingIds": {
      "type": "array",
      "maxItems": 20,
      "items": {
        "type": "string"
      }
    },
    "dependencyCount": {
      "type": "integer",
      "minimum": 0,
      "maximum": 1000
    },
    "incomplete": {
      "type": "boolean"
    },
    "manualReason": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ]
    },
    "progress": {
      "oneOf": [
        {
          "type": "string",
          "enum": [
            "New"
          ]
        },
        {
          "type": "string",
          "enum": [
            "InProgress"
          ]
        },
        {
          "type": "string",
          "enum": [
            "Done"
          ]
        }
      ]
    },
    "source": {
      "type": "object",
      "required": [
        "authorizationEpoch",
        "epoch",
        "head"
      ],
      "properties": {
        "authorizationEpoch": {
          "type": "string"
        },
        "epoch": {
          "type": "string"
        },
        "head": {
          "type": "string"
        }
      },
      "additionalProperties": false
    },
    "status": {
      "oneOf": [
        {
          "type": "string",
          "enum": [
            "New"
          ]
        },
        {
          "type": "string",
          "enum": [
            "InProgress"
          ]
        },
        {
          "type": "string",
          "enum": [
            "Done"
          ]
        },
        {
          "type": "string",
          "enum": [
            "Locked"
          ]
        },
        {
          "type": "string",
          "enum": [
            "Unknown"
          ]
        }
      ]
    }
  },
  "additionalProperties": false
};
