# Testing Bases Tools

Tools: `list_bases`, `get_base`, `query_base`

> **Note**: Obsidian Bases is a relatively new feature. These tools work with `.base` files in your vault.

## Test 1: List All Bases

```
List all database files (bases) in the vault
```

Expected: Returns list of .base files with names and paths.

---

## Test 2: Get Base Structure

```
Get the structure and content of "tasks.base" (or any base that exists)
```

Expected: Returns the base schema (columns) and all rows.

---

## Test 3: Get Base Columns

```
Show the column definitions for "projects.base"
```

Expected: Returns column names, types, and any options.

---

## Test 4: Query Base (All Records)

```
Get all records from "contacts.base"
```

Expected: Returns all rows from the base.

---

## Test 5: Query Base with Filter

```
Query "tasks.base" and filter for records where status = "active"
```

Expected: Returns only rows matching the filter.

---

## Test 6: Query Base with Sort

```
Query "projects.base" and sort by "deadline" in ascending order
```

Expected: Returns rows sorted by the specified column.

---

## Test 7: Query Base with Limit

```
Get the first 10 records from "notes.base"
```

Expected: Returns at most 10 rows.

---

## Test 8: Query with Multiple Conditions

```
Query "tasks.base" where:
- status = "in-progress"
- priority = "high"
Sorted by created date, limited to 5 results
```

Expected: Returns filtered, sorted, and limited results.

---

## Full Flow Test

```
Test bases functionality:
1. List all bases in the vault
2. If a base exists, get its full structure and content
3. Show the column definitions
4. Query the base without filters to see all records
5. Query with a filter on one of the columns
6. Query with sorting on a date or text column
7. Query with a limit of 3 records
```

---

## Supported Base Formats

The bases parser supports:

- **JSON format**: Standard JSON with columns and rows
- **Array format**: Simple array of objects
- **Schema + data format**: Separate schema and data sections
- **Markdown tables**: Basic markdown table format

## Column Types

Detected column types include:
- `text` - String values
- `number` - Numeric values
- `checkbox` - Boolean values
- `date` - Date strings (YYYY-MM-DD)
- `url` - HTTP/HTTPS URLs
- `multi-select` - Array values
