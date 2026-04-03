/**
 * A skill that a clawmon can execute
 * Skills are the implementation, tools are the API calls
 */
export interface Skill {
  name: string;
  description: string;
  // JSON schema for the tool parameters (sent to Claude API)
  inputSchema: Record<string, unknown>;
  // Execute the skill and return a string result
  execute: (input: Record<string, unknown>) => Promise<string>;
}

export interface SkillRegistry {
  skills: Skill[];
  getToolDefinitions: () => Array<{
    name: string;
    description: string;
    input_schema: Record<string, unknown>;
  }>;
  execute: (name: string, input: Record<string, unknown>) => Promise<string>;
}
