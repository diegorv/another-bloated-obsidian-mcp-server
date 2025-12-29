# Testing Bases Tools

Tools: `list_bases`, `get_base`, `query_base`

> **Note**: Obsidian Bases is a feature that creates dynamic views of notes based on filters. The `.base` file is a YAML configuration that defines which notes to include. The actual data comes from notes in the vault that match the filters.

## How Obsidian Bases Work

A `.base` file defines:
- **filters**: Rules to select which notes to include (e.g., by tag, folder, or property)
- **properties**: How to display note properties with custom display names
- **formulas**: Calculated fields (e.g., age from birthday)
- **views**: Table/card layouts and sorting

The data is NOT stored in the `.base` file - it comes from matching notes in your vault.

---

## Test 1: List All Bases

```
List all database files (bases) in the vault
```

Expected: Returns list of .base files with names and paths.

---

## Test 2: Get Base Structure and Data

```
Get the structure and content of "People.base" (or any base that exists)
```

Expected: Returns the base configuration, columns (from config properties), and rows (from matching notes).

---

## Test 3: Create a Test Base

First, create some notes with tags:

```
Create a note "People/John Doe.md" with:
- tags: ["people"]
- birthday: 1990-05-15
- Content: "# John Doe\n\nA person note."
```

```
Create a note "People/Jane Smith.md" with:
- tags: ["people", "vip"]
- birthday: 1985-10-20
- Content: "# Jane Smith\n\nAnother person."
```

Then create a base file manually in your vault at `Bases/People.base`:

```yaml
filters:
  and:
    - note.tags.contains("people")
properties:
  file.name:
    displayName: Name
  note.tags:
    displayName: Tags
  note.birthday:
    displayName: Birthday
formulas:
  Age: (now() - birthday).years.floor()
```

---

## Test 4: Query Base (All Records)

```
Get all records from "Bases/People.base"
```

Expected: Returns all notes that have the tag "people".

---

## Test 5: Query Base with Filter

```
Query "Bases/People.base" and filter for records where file.name = "John Doe"
```

Expected: Returns only John Doe's record.

---

## Test 6: Query Base with Sort

```
Query "Bases/People.base" and sort by "birthday" in descending order
```

Expected: Returns rows sorted by birthday (most recent first).

---

## Test 7: Query Base with Limit

```
Get the first 1 record from "Bases/People.base"
```

Expected: Returns at most 1 row.

---

## Test 8: Formula Evaluation

```
Get "Bases/People.base" and check if the Age formula is calculated
```

Expected: Each person should have a `formula.Age` value calculated from their birthday.

---

## Full Flow Test

```
Test bases functionality:
1. List all bases in the vault
2. If a base exists, get its full structure and content
3. Check the columns (from config properties)
4. Query the base without filters to see all matching notes
5. Query with an additional filter on one of the columns
6. Query with sorting on a column
7. Query with a limit of 1 record
```

---

## Supported Filter Types

The bases parser supports these filter patterns:

| Filter Pattern | Description | Example |
|----------------|-------------|---------|
| `note.tags.contains("tag")` | Notes with a specific tag | `note.tags.contains("people")` |
| `file.name.contains("text")` | Notes with text in filename | `file.name.contains("Template")` |
| `file.folder.contains("path")` | Notes in a specific folder | `file.folder.contains("Projects")` |
| `!filter` | Negation (NOT) | `!file.name.contains("Template")` |

Filters can be combined with:
- `and`: All conditions must match
- `or`: Any condition can match

## Supported Formula Types

Currently supported:
- **Age calculation**: `(now() - property).years.floor()` - Calculates years between a date property and now

## Column Types

Detected column types include:
- `text` - String values
- `number` - Numeric values
- `checkbox` - Boolean values
- `date` - Date strings (YYYY-MM-DD) or Date objects
- `url` - HTTP/HTTPS URLs
- `multi-select` - Array values
- `formula` - Calculated fields
