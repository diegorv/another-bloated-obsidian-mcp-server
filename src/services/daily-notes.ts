/**
 * Daily notes service
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { validatePath, getRelativePath } from '../utils/path.js';

export interface DailyNotesConfig {
  folder: string;
  format: string;
  template?: string;
}

const DEFAULT_CONFIG: DailyNotesConfig = {
  folder: '',
  format: 'YYYY-MM-DD',
};

/**
 * Loads the daily notes configuration from the vault
 */
export async function loadDailyNotesConfig(vaultPath: string): Promise<DailyNotesConfig> {
  const configPath = path.join(vaultPath, '.obsidian', 'daily-notes.json');

  try {
    const content = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(content);
    return {
      folder: config.folder || '',
      format: config.format || 'YYYY-MM-DD',
      template: config.template,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

/**
 * Formats a date according to a format string
 * Supports: YYYY, YY, MM, DD, ddd, dddd, MMM, MMMM
 */
export function formatDate(date: Date, format: string): string {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
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
    .replace('ddd', daysShort[dayOfWeek]);
}

/**
 * Parses a date string according to a format
 */
export function parseDate(dateStr: string, format: string): Date | null {
  // Handle common formats
  const yearMatch = dateStr.match(/\d{4}/);
  const monthMatch = dateStr.match(/(?<!\d)(\d{1,2})(?!\d)/g);
  const dayMatch = monthMatch && monthMatch.length >= 2 ? monthMatch[1] : monthMatch?.[0];

  if (!yearMatch) return null;

  const year = parseInt(yearMatch[0], 10);
  let month = 0;
  let day = 1;

  // Try to extract month and day based on format
  if (format.includes('MM') && monthMatch) {
    const monthIndex = format.indexOf('MM');
    const dayIndex = format.indexOf('DD');

    if (monthIndex < dayIndex && monthMatch.length >= 2) {
      month = parseInt(monthMatch[0], 10) - 1;
      day = parseInt(monthMatch[1], 10);
    } else if (monthMatch.length >= 2) {
      day = parseInt(monthMatch[0], 10);
      month = parseInt(monthMatch[1], 10) - 1;
    }
  }

  const date = new Date(year, month, day);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Gets the path for a daily note given a date
 */
export function getDailyNotePath(config: DailyNotesConfig, date: Date): string {
  const filename = formatDate(date, config.format) + '.md';
  return config.folder ? path.join(config.folder, filename) : filename;
}

/**
 * Lists daily notes in a date range
 */
export async function listDailyNotes(
  vaultPath: string,
  config: DailyNotesConfig,
  startDate?: Date,
  endDate?: Date
): Promise<{ path: string; date: string }[]> {
  const folder = config.folder || '';
  const folderPath = folder ? validatePath(folder, vaultPath) : vaultPath;

  const notes: { path: string; date: string }[] = [];

  try {
    const entries = await fs.readdir(folderPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;

      const noteName = entry.name.replace('.md', '');
      const date = parseDate(noteName, config.format);

      if (!date) continue;

      // Filter by date range if provided
      if (startDate && date < startDate) continue;
      if (endDate && date > endDate) continue;

      const relativePath = folder ? path.join(folder, entry.name) : entry.name;
      notes.push({
        path: relativePath,
        date: date.toISOString().split('T')[0],
      });
    }
  } catch {
    // Folder might not exist
  }

  // Sort by date descending
  notes.sort((a, b) => b.date.localeCompare(a.date));
  return notes;
}

/**
 * Gets or creates a daily note for a specific date
 */
export async function getOrCreateDailyNote(
  vaultPath: string,
  config: DailyNotesConfig,
  date: Date = new Date()
): Promise<{ path: string; created: boolean; content: string }> {
  const notePath = getDailyNotePath(config, date);
  const fullPath = validatePath(notePath, vaultPath);

  try {
    const content = await fs.readFile(fullPath, 'utf-8');
    return { path: notePath, created: false, content };
  } catch {
    // Note doesn't exist, create it
    let content = `# ${formatDate(date, config.format)}\n\n`;

    // Load template if configured
    if (config.template) {
      try {
        const templatePath = validatePath(config.template + '.md', vaultPath);
        content = await fs.readFile(templatePath, 'utf-8');
        // Replace date placeholders
        content = content.replace(/\{\{date\}\}/g, formatDate(date, config.format));
        content = content.replace(/\{\{date:([^}]+)\}\}/g, (_, fmt) => formatDate(date, fmt));
      } catch {
        // Template not found, use default
      }
    }

    // Ensure directory exists
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, 'utf-8');

    return { path: notePath, created: true, content };
  }
}

/**
 * Appends content to a daily note
 */
export async function appendToDailyNote(
  vaultPath: string,
  config: DailyNotesConfig,
  content: string,
  date: Date = new Date()
): Promise<string> {
  const { path: notePath } = await getOrCreateDailyNote(vaultPath, config, date);
  const fullPath = validatePath(notePath, vaultPath);

  const existingContent = await fs.readFile(fullPath, 'utf-8');
  const newContent = existingContent.trimEnd() + '\n\n' + content;
  await fs.writeFile(fullPath, newContent, 'utf-8');

  return notePath;
}
