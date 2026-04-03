import type { Skill } from './types.js';

export const calculatorSkill: Skill = {
  name: 'calculator',
  description: 'Evaluate mathematical expressions. Use for budgets, compound interest, percentages, conversions, and any numeric calculations. Supports standard math operators (+, -, *, /, **, %), parentheses, and common functions (Math.round, Math.ceil, Math.floor, Math.sqrt, Math.pow).',
  inputSchema: {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description: 'A JavaScript math expression to evaluate. Examples: "1200 * 12", "5000 * (1.07 ** 10)", "((85000 - 12000) * 0.42) + 12000 * 0.14"',
      },
      label: {
        type: 'string',
        description: 'A human-readable label for what this calculation represents, e.g. "Monthly rent per year" or "Savings after 10 years at 7%"',
      },
    },
    required: ['expression'],
  },

  async execute(input: Record<string, unknown>): Promise<string> {
    const expr = String(input.expression ?? '');
    const label = input.label ? String(input.label) : undefined;

    // Sanitize: only allow numbers, operators, parens, whitespace, Math.*, and dots
    const sanitized = expr.replace(/\s/g, '');
    if (!/^[\d+\-*/().,%eE\s]+(Math\.(round|ceil|floor|sqrt|pow|abs|min|max)\([\d+\-*/().,%eE\s]*\))*[\d+\-*/().,%eE\s]*$/.test(sanitized) && !sanitized.match(/^[0-9+\-*/().%eE\s^Math.roundceilflorsqtpwabminx,]+$/)) {
      // Fallback: try a more permissive check
      const forbidden = /[;{}\[\]`'"\\$&|~!?<>:=]/;
      if (forbidden.test(expr)) {
        return `Error: Expression contains forbidden characters. Only math operators and Math.* functions allowed.`;
      }
    }

    try {
      // Safe-ish eval for math expressions
      const fn = new Function('Math', `"use strict"; return (${expr});`);
      const result = fn(Math);

      if (typeof result !== 'number' || !isFinite(result)) {
        return `Error: Expression did not produce a valid number. Got: ${result}`;
      }

      const formatted = Number.isInteger(result) ? String(result) : result.toFixed(2);
      return label ? `${label}: ${formatted}` : formatted;
    } catch (err: any) {
      return `Error evaluating expression: ${err.message}`;
    }
  },
};
