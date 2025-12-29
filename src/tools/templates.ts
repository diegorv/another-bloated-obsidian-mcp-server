/**
 * Template tools
 */

import { z } from 'zod';
import { getActiveVaultPath } from '../services/vault-manager.js';
import { formatError } from '../utils/errors.js';
import {
  listTemplates,
  getTemplate,
  applyTemplateVariables,
  createFromTemplate,
  getTemplatesFolder,
} from '../services/template-engine.js';

// Schema definitions
export const listTemplatesSchema = z.object({});

export const getTemplateSchema = z.object({
  name: z.string().describe('Name of the template'),
});

export const applyTemplateSchema = z.object({
  name: z.string().describe('Name of the template to apply'),
  title: z.string().optional().describe('Title to use in the template'),
  variables: z.record(z.string(), z.string()).optional().describe('Custom variables to replace in the template'),
});

export const createFromTemplateSchema = z.object({
  template: z.string().describe('Name of the template to use'),
  path: z.string().describe('Path for the new note'),
  title: z.string().optional().describe('Title to use in the template'),
  variables: z.record(z.string(), z.string()).optional().describe('Custom variables to replace in the template'),
});

// Tool implementations
export async function handleListTemplates() {
  try {
    const vaultPath = await getActiveVaultPath();
    const templates = await listTemplates(vaultPath);
    const folder = await getTemplatesFolder();

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              folder,
              count: templates.length,
              templates,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ error: formatError(error) }),
        },
      ],
      isError: true,
    };
  }
}

export async function handleGetTemplate(args: z.infer<typeof getTemplateSchema>) {
  try {
    const vaultPath = await getActiveVaultPath();
    const content = await getTemplate(vaultPath, args.name);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              name: args.name,
              content,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ error: formatError(error) }),
        },
      ],
      isError: true,
    };
  }
}

export async function handleApplyTemplate(args: z.infer<typeof applyTemplateSchema>) {
  try {
    const vaultPath = await getActiveVaultPath();
    const templateContent = await getTemplate(vaultPath, args.name);

    const processed = applyTemplateVariables(templateContent, {
      title: args.title,
      date: new Date(),
      customVars: args.variables,
    });

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              name: args.name,
              processedContent: processed,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ error: formatError(error) }),
        },
      ],
      isError: true,
    };
  }
}

export async function handleCreateFromTemplate(args: z.infer<typeof createFromTemplateSchema>) {
  try {
    const vaultPath = await getActiveVaultPath();

    const result = await createFromTemplate(vaultPath, args.template, args.path, {
      title: args.title,
      date: new Date(),
      customVars: args.variables,
    });

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              success: true,
              path: result.path,
              template: args.template,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ success: false, error: formatError(error) }),
        },
      ],
      isError: true,
    };
  }
}

// Tool definitions for MCP
export const templateTools = [
  {
    name: 'list_templates',
    description: 'List all available templates in the vault\'s templates folder',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_template',
    description: 'Get the raw content of a template file',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: {
          type: 'string',
          description: 'Name of the template (without .md extension)',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'apply_template',
    description:
      'Apply a template with variables and return the processed content without creating a file. Supports {{title}}, {{date}}, {{date:FORMAT}}, {{time}}, and custom {{variable}} placeholders.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: {
          type: 'string',
          description: 'Name of the template',
        },
        title: {
          type: 'string',
          description: 'Title to replace {{title}} placeholder',
        },
        variables: {
          type: 'object',
          description: 'Custom variables as key-value pairs (e.g., {"author": "John"})',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'create_from_template',
    description: 'Create a new note from a template with variable substitution',
    inputSchema: {
      type: 'object' as const,
      properties: {
        template: {
          type: 'string',
          description: 'Name of the template to use',
        },
        path: {
          type: 'string',
          description: 'Path for the new note',
        },
        title: {
          type: 'string',
          description: 'Title for the note (also replaces {{title}} in template)',
        },
        variables: {
          type: 'object',
          description: 'Custom variables as key-value pairs',
        },
      },
      required: ['template', 'path'],
    },
  },
];
