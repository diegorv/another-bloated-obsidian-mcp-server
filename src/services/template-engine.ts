/**
 * Template engine for Obsidian templates
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { validatePath, isMarkdownFile, getRelativePath } from '../utils/path.js';
import { loadConfig } from '../config.js';

/**
 * Built-in template variables
 */
export interface TemplateContext {
  title?: string;
  date?: Date;
  customVars?: Record<string, string>;
}

/**
 * Formats a date according to a format string
 */
function formatDate(date: Date, format: string): string {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  const dayOfWeek = date.getDay();

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const daysShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return format
    .replace('YYYY', String(year))
    .replace('YY', String(year).slice(-2))
    .replace('MMMM', months[month])
    .replace('MMM', monthsShort[month])
    .replace('MM', String(month + 1).padStart(2, '0'))
    .replace('DD', String(day).padStart(2, '0'))
    .replace('dddd', days[dayOfWeek])
    .replace('ddd', daysShort[dayOfWeek])
    .replace('HH', String(hours).padStart(2, '0'))
    .replace('mm', String(minutes).padStart(2, '0'))
    .replace('ss', String(seconds).padStart(2, '0'));
}

/**
 * Gets the templates folder from config or default
 */
export async function getTemplatesFolder(): Promise<string> {
  const config = await loadConfig();
  return config.options.templatesFolder || 'Templates';
}

/**
 * Lists all available templates in the vault
 */
export async function listTemplates(vaultPath: string): Promise<{ name: string; path: string }[]> {
  const templatesFolder = await getTemplatesFolder();
  const templatePath = path.join(vaultPath, templatesFolder);
  const templates: { name: string; path: string }[] = [];

  try {
    const entries = await fs.readdir(templatePath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isFile() && isMarkdownFile(entry.name)) {
        templates.push({
          name: entry.name.replace(/\.(md|markdown)$/, ''),
          path: path.join(templatesFolder, entry.name),
        });
      }
    }
  } catch {
    // Templates folder might not exist
  }

  return templates.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Gets the content of a template
 */
export async function getTemplate(vaultPath: string, templateName: string): Promise<string> {
  const templatesFolder = await getTemplatesFolder();

  // Try with .md extension
  let templatePath = path.join(templatesFolder, templateName);
  if (!templatePath.endsWith('.md') && !templatePath.endsWith('.markdown')) {
    templatePath += '.md';
  }

  const fullPath = validatePath(templatePath, vaultPath);
  return await fs.readFile(fullPath, 'utf-8');
}

/**
 * Applies template variables to content
 */
export function applyTemplateVariables(content: string, context: TemplateContext): string {
  const date = context.date || new Date();
  let result = content;

  // Replace {{title}}
  if (context.title) {
    result = result.replace(/\{\{title\}\}/gi, context.title);
  }

  // Replace {{date}} with default format
  result = result.replace(/\{\{date\}\}/gi, formatDate(date, 'YYYY-MM-DD'));

  // Replace {{time}} with default format
  result = result.replace(/\{\{time\}\}/gi, formatDate(date, 'HH:mm'));

  // Replace {{date:FORMAT}} with custom format
  result = result.replace(/\{\{date:([^}]+)\}\}/gi, (_, fmt) => formatDate(date, fmt));

  // Replace {{time:FORMAT}} with custom format
  result = result.replace(/\{\{time:([^}]+)\}\}/gi, (_, fmt) => formatDate(date, fmt));

  // Replace custom variables
  if (context.customVars) {
    for (const [key, value] of Object.entries(context.customVars)) {
      const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'gi');
      result = result.replace(pattern, value);
    }
  }

  return result;
}

/**
 * Creates a note from a template
 */
export async function createFromTemplate(
  vaultPath: string,
  templateName: string,
  targetPath: string,
  context: TemplateContext = {}
): Promise<{ path: string; content: string }> {
  // Get template content
  const templateContent = await getTemplate(vaultPath, templateName);

  // Extract title from target path if not provided
  const title = context.title || path.basename(targetPath, path.extname(targetPath));

  // Apply variables
  const processedContent = applyTemplateVariables(templateContent, {
    ...context,
    title,
  });

  // Write the new note
  let notePath = targetPath;
  if (!notePath.endsWith('.md') && !notePath.endsWith('.markdown')) {
    notePath += '.md';
  }

  const fullPath = validatePath(notePath, vaultPath);

  // Ensure parent directory exists
  await fs.mkdir(path.dirname(fullPath), { recursive: true });

  await fs.writeFile(fullPath, processedContent, 'utf-8');

  return {
    path: getRelativePath(fullPath, vaultPath),
    content: processedContent,
  };
}
