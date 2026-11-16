interface CommandInputDataSchema {
  type: 'object';
  required: string[];
  properties: Record<string, unknown>;
  additionalProperties: false;
}
declare const schemas: Record<string, CommandInputDataSchema>;
export default schemas;
