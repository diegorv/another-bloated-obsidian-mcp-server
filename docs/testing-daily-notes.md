According to the Obsidian MCP that I'm running, run the script below. At the end, list what worked and what didn't work. If you understand that there are opportunities for improvement, list them too. Don't stop the script if any error happens.

# Testing Daily Notes Tools

Tools: `get_daily_note`, `create_daily_note`, `list_daily_notes`, `append_to_daily`

## Test 1: Get Today's Daily Note

```
Get today's daily note
```

Expected: Returns the content of today's daily note, or indicates it doesn't exist.

---

## Test 2: Get Daily Note for Specific Date

```
Get the daily note for 2024-01-15
```

Expected: Returns the daily note for that date if it exists.

---

## Test 3: Create Today's Daily Note

```
Create today's daily note with a default template
```

Expected: Creates a new daily note for today (if it doesn't exist).

---

## Test 4: Create Daily Note for Specific Date

```
Create a daily note for 2024-12-25 with content "# Christmas Day\n\n## Goals\n- Celebrate!"
```

Expected: Creates the daily note for the specified date.

---

## Test 5: Create Daily Note with Template

```
Create today's daily note using the "daily" template
```

Expected: Creates daily note with template content applied.

---

## Test 6: List Daily Notes

```
List all daily notes from the past 7 days
```

Expected: Returns list of daily notes within the date range.

---

## Test 7: List Daily Notes (Date Range)

```
List all daily notes from 2024-01-01 to 2024-01-31
```

Expected: Returns daily notes within the specified month.

---

## Test 8: Append to Today's Daily Note

```
Append to today's daily note:

## 3:00 PM - Meeting Notes
- Discussed project timeline
- Action items assigned
```

Expected: Content is appended to today's daily note.

---

## Test 9: Append to Specific Daily Note

```
Append a task "- [ ] Follow up on email" to the daily note for yesterday
```

Expected: Content is appended to yesterday's daily note.

---

## Full Flow Test

```
Test daily notes workflow:
1. Check if today's daily note exists
2. If not, create today's daily note with heading "# Daily Note - [today's date]" and sections for Tasks, Notes, and Journal
3. Append a morning entry: "## Morning\n- Started work at 9 AM\n- Reviewed emails"
4. Get today's daily note to verify the content
5. List daily notes from the past 5 days
6. Append an afternoon entry: "## Afternoon\n- Completed MCP testing\n- Updated documentation"
7. Get the daily note one more time to see complete content
```
