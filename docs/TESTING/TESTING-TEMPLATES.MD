According to the Obsidian MCP that I'm running, run the script below. At the end, list what worked and what didn't work. If you understand that there are opportunities for improvement, list them too. Don't stop the script if any error happens.

# Testing Templates Tools

Tools: `list_templates`, `get_template`, `apply_template`, `create_from_template`

## Test 1: List Available Templates

```
List all available templates in the vault
```

Expected: Returns list of template files from the templates folder.

---

## Test 2: Get Template Content

```
Get the raw content of the "meeting" template (or any template that exists)
```

Expected: Returns the template file content with placeholders visible.

---

## Test 3: Apply Template (Preview)

```
Apply the "meeting" template with title "Project Kickoff" and show the result (without creating a file)
```

Expected: Returns processed template with variables substituted.

---

## Test 4: Apply Template with Variables

```
Apply the "project" template with:
- title: "New Website"
- date: today
- author: "John Doe"
- custom variable "client": "Acme Corp"
```

Expected: Returns template with all variables replaced.

---

## Test 5: Create Note from Template

```
Create a new note "Meetings/2024-01-15-standup.md" from the "meeting" template with title "Daily Standup"
```

Expected: New note is created with template content and variables applied.

---

## Test 6: Create from Template with Custom Variables

```
Create a note "Projects/website-redesign.md" from the "project" template with:
- title: "Website Redesign"
- variables: client="Acme", deadline="2024-03-01", priority="high"
```

Expected: Note is created with all custom variables substituted.

---

## Test 7: Template Date Formatting

```
Apply a template that uses {{date:YYYY-MM-DD}} and {{date:dddd, MMMM D}} to see different date formats
```

Expected: Dates are formatted according to the format strings.

---

## Full Flow Test

```
Test templates workflow:
1. List all available templates
2. If a "note" or "basic" template exists, get its content
3. Apply the template with title "Template Test" to preview the result
4. Create a new note "template-test.md" from the template
5. Read the created note to verify content
6. If a template with custom variables exists, create another note with custom values
7. Delete the test notes when done
```

---

## Supported Template Variables

The following variables are supported in templates:

- `{{title}}` - The title parameter
- `{{date}}` - Current date (YYYY-MM-DD format)
- `{{date:FORMAT}}` - Current date with custom format (e.g., {{date:MMMM D, YYYY}})
- `{{time}}` - Current time (HH:mm format)
- `{{time:FORMAT}}` - Current time with custom format
- Custom variables passed via the variables parameter
