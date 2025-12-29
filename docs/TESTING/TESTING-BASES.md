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

## Expression Parser

The bases parser includes a full expression parser that supports complex filter expressions and formulas.

### Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `==`, `=` | Equality | `status == "active"` |
| `!=` | Inequality | `status != "done"` |
| `>` | Greater than | `priority > 5` |
| `>=` | Greater than or equal | `priority >= 5` |
| `<` | Less than | `priority < 3` |
| `<=` | Less than or equal | `priority <= 3` |
| `&&`, `and` | Logical AND | `status == "active" && priority > 3` |
| `\|\|`, `or` | Logical OR | `status == "done" \|\| status == "cancelled"` |
| `!`, `not` | Logical NOT | `!file.name.contains("Template")` |
| `+` | Addition / Concatenation | `price + tax`, `"Hello " + name` |
| `-` | Subtraction | `total - discount` |
| `*` | Multiplication | `quantity * price` |
| `/` | Division | `total / count` |
| `%` | Modulo | `index % 2` |

---

## Supported Filter Types

### Basic Filters

| Filter Pattern | Description | Example |
|----------------|-------------|---------|
| `note.tags.contains("tag")` | Notes with a specific tag | `note.tags.contains("people")` |
| `file.name.contains("text")` | Notes with text in filename | `file.name.contains("Template")` |
| `file.folder.contains("path")` | Notes in a specific folder | `file.folder.contains("Projects")` |
| `!filter` | Negation (NOT) | `!file.name.contains("Template")` |

### Advanced Filters (Expression Parser)

| Filter Pattern | Description | Example |
|----------------|-------------|---------|
| `property == value` | Property equals value | `status == "active"` |
| `property != value` | Property not equals | `status != "done"` |
| `property > value` | Comparison | `priority > 3` |
| `file.hasTag("tag")` | Check if file has tag | `file.hasTag("project")` |
| `file.inFolder("path")` | Check if in folder | `file.inFolder("Projects")` |
| `file.hasProperty("name")` | Check if has property | `file.hasProperty("status")` |
| `file.hasLink("path")` | Check if links to file | `file.hasLink("Index.md")` |
| `file.mtime > now() - "7d"` | Date comparison | Modified in last 7 days |

Filters can be combined with:
- `and`: All conditions must match
- `or`: Any condition can match

---

## File Properties

The following file properties are available in filters and formulas:

| Property | Type | Description |
|----------|------|-------------|
| `file.name` | string | File name without extension |
| `file.path` | string | Relative path from vault root |
| `file.folder` | string | Parent folder path |
| `file.ext` | string | File extension (without dot) |
| `file.basename` | string | File name without path or extension |
| `file.size` | number | File size in bytes |
| `file.ctime` | Date | Creation time |
| `file.mtime` | Date | Last modification time |
| `file.tags` | List | Tags from frontmatter and content |
| `file.links` | List | Outgoing wiki links |
| `file.embeds` | List | Embedded content references |

---

## Global Functions

| Function | Description | Example |
|----------|-------------|---------|
| `now()` | Current date/time | `now()` |
| `today()` | Today at midnight | `today()` |
| `date("string")` | Parse date string | `date("2024-01-15")` |
| `if(cond, true, false)` | Conditional | `if(status == "done", "Complete", "Pending")` |
| `min(...values)` | Minimum value | `min(1, 2, 3)` |
| `max(...values)` | Maximum value | `max(1, 2, 3)` |
| `number(value)` | Convert to number | `number("42")` |
| `list(...values)` | Create list | `list(1, 2, 3)` |
| `link(path, display?)` | Create link | `link("note.md", "My Note")` |
| `duration("string")` | Parse duration | `duration("7d")` |

---

## Date Arithmetic

### Duration Units

| Unit | Aliases |
|------|---------|
| Years | `y`, `year`, `years` |
| Months | `M`, `month`, `months` |
| Weeks | `w`, `week`, `weeks` |
| Days | `d`, `day`, `days` |
| Hours | `h`, `hour`, `hours` |
| Minutes | `m`, `min`, `minute`, `minutes` |
| Seconds | `s`, `sec`, `second`, `seconds` |

### Date Operations

| Operation | Description | Example |
|-----------|-------------|---------|
| `date + "duration"` | Add duration | `today() + "7d"` |
| `date - "duration"` | Subtract duration | `now() - "1M"` |
| `date1 - date2` | Difference (ms) | `now() - file.ctime` |
| `(diff).years` | Convert ms to years | `(now() - birthday).years` |
| `(diff).days` | Convert ms to days | `(now() - file.mtime).days` |

---

## Date Functions

| Function/Property | Description | Example |
|-------------------|-------------|---------|
| `date.year` | Year (4 digits) | `birthday.year` |
| `date.month` | Month (1-12) | `birthday.month` |
| `date.day` | Day of month | `birthday.day` |
| `date.hour` | Hour (0-23) | `file.mtime.hour` |
| `date.minute` | Minute (0-59) | `file.mtime.minute` |
| `date.second` | Second (0-59) | `file.mtime.second` |
| `date.format("pattern")` | Format date | `birthday.format("YYYY-MM-DD")` |
| `date.relative()` | Relative time | `file.mtime.relative()` → "3 days ago" |
| `date.date()` | Date without time | `now().date()` |
| `date.time()` | Time string | `now().time()` → "14:30:45" |

---

## String Functions

| Function | Description | Example |
|----------|-------------|---------|
| `str.contains("value")` | Contains substring | `name.contains("John")` |
| `str.containsAll("a", "b")` | Contains all | `name.containsAll("John", "Doe")` |
| `str.containsAny("a", "b")` | Contains any | `status.containsAny("done", "complete")` |
| `str.startsWith("prefix")` | Starts with | `name.startsWith("Dr.")` |
| `str.endsWith("suffix")` | Ends with | `file.name.endsWith("_draft")` |
| `str.lower()` | Lowercase | `name.lower()` |
| `str.upper()` | Uppercase | `name.upper()` |
| `str.title()` | Title case | `name.title()` |
| `str.trim()` | Remove whitespace | `name.trim()` |
| `str.replace("a", "b")` | Replace text | `status.replace("_", " ")` |
| `str.split(",")` | Split to list | `tags.split(",")` |
| `str.slice(start, end)` | Substring | `name.slice(0, 10)` |
| `str.length` | String length | `name.length` |
| `str.isEmpty()` | Check if empty | `description.isEmpty()` |

---

## Number Functions

| Function | Description | Example |
|----------|-------------|---------|
| `num.abs()` | Absolute value | `(-5).abs()` → 5 |
| `num.ceil()` | Round up | `(4.2).ceil()` → 5 |
| `num.floor()` | Round down | `(4.8).floor()` → 4 |
| `num.round(digits?)` | Round | `(4.567).round(2)` → 4.57 |
| `num.toFixed(digits)` | Format decimal | `(4.5).toFixed(2)` → "4.50" |

---

## List Functions

| Function | Description | Example |
|----------|-------------|---------|
| `list.contains(value)` | Contains element | `tags.contains("important")` |
| `list.containsAll(a, b)` | Contains all | `tags.containsAll("a", "b")` |
| `list.containsAny(a, b)` | Contains any | `tags.containsAny("urgent", "high")` |
| `list.join(",")` | Join to string | `tags.join(", ")` |
| `list.sort()` | Sort list | `tags.sort()` |
| `list.reverse()` | Reverse list | `items.reverse()` |
| `list.unique()` | Remove duplicates | `tags.unique()` |
| `list.flat()` | Flatten nested | `nested.flat()` |
| `list.slice(start, end)` | Slice list | `items.slice(0, 5)` |
| `list.first()` | First element | `tags.first()` |
| `list.last()` | Last element | `tags.last()` |
| `list.length` | List length | `tags.length` |
| `list.isEmpty()` | Check if empty | `tags.isEmpty()` |

---

## Any Type Functions

| Function | Description | Example |
|----------|-------------|---------|
| `value.toString()` | Convert to string | `(42).toString()` |
| `value.isTruthy()` | Check if truthy | `status.isTruthy()` |
| `value.isType("type")` | Check type | `value.isType("string")` |

Type names: `string`, `number`, `boolean`, `date`, `list`, `array`, `object`, `null`, `undefined`, `link`, `regex`, `file`, `image`, `icon`, `html`

---

## Link Functions

| Function | Description | Example |
|----------|-------------|---------|
| `link.asFile()` | Convert link to File object | `myLink.asFile()` |
| `link.linksTo(file)` | Check if link points to file | `myLink.linksTo("note.md")` |

---

## Object Functions

| Function | Description | Example |
|----------|-------------|---------|
| `object.isEmpty()` | Check if object is empty | `obj.isEmpty()` |
| `object.keys()` | Get list of keys | `obj.keys()` |
| `object.values()` | Get list of values | `obj.values()` |
| `object.entries()` | Get list of [key, value] pairs | `obj.entries()` |
| `object.hasKey(key)` | Check if object has key | `obj.hasKey("status")` |

---

## Regular Expressions

Regular expressions can be used in filters and formulas:

```
/pattern/flags.matches(value)
```

| Method | Description | Example |
|--------|-------------|---------|
| `matches(value)` | Test if value matches pattern | `/hello/.matches("hello world")` |
| `test(value)` | Alias for matches | `/\\d+/.test("abc123")` |
| `exec(value)` | Execute and return match array | `/hello/.exec("hello world")` |

**Flags**: `g` (global), `i` (case-insensitive), `m` (multiline), `s` (dotall), `u` (unicode), `y` (sticky)

---

## `this` Object

The `this` keyword provides context about the current file:

```yaml
# In a base filter, use this to reference the embedding file
filters:
  and:
    - 'file.hasLink(this.file)'  # Find notes that link to the current file
```

The `this` object changes based on context:
- When base is opened directly: `this.file` = the .base file
- When base is embedded: `this.file` = the file containing the embed
- When base is in sidebar: `this.file` = the currently active file

---

## Advanced Functions

| Function | Description | Example |
|----------|-------------|---------|
| `file(path)` | Create File object from path | `file("folder/note.md")` |
| `image(path)` | Create Image object for rendering | `image("path/to/img.png")` |
| `icon(name)` | Create Icon object (Lucide icons) | `icon("star")` |
| `html(content)` | Create HTML object for rendering | `html("<b>bold</b>")` |
| `escapeHTML(str)` | Escape HTML special characters | `escapeHTML("<script>")` |

---

## Supported Formula Types

Formulas can use any expression with the full expression parser:

```yaml
formulas:
  Age: (now() - birthday).years.floor()
  DaysSinceModified: (now() - file.mtime).days.floor()
  FullName: firstName + " " + lastName
  IsOverdue: due_date < today()
  Priority: if(urgent, "High", "Normal")
  TagCount: tags.length
```

---

## Column Types

Detected column types include:
- `text` - String values
- `number` - Numeric values
- `checkbox` - Boolean values
- `date` - Date strings (YYYY-MM-DD) or Date objects
- `url` - HTTP/HTTPS URLs
- `multi-select` - Array values
- `formula` - Calculated fields

---

## Summaries (Aggregations)

Summaries allow you to aggregate column values. Add a `summaries` section to your base config:

```yaml
summaries:
  price: Average
  quantity: Sum
  due_date: Earliest
```

### Built-in Summary Types

| Summary | Input Type | Description |
|---------|------------|-------------|
| `Average` | Number | Mean of all values |
| `Min` | Number | Smallest value |
| `Max` | Number | Largest value |
| `Sum` | Number | Total of all values |
| `Range` | Number | Max - Min |
| `Median` | Number | Middle value |
| `Stddev` | Number | Standard deviation |
| `Earliest` | Date | Oldest date |
| `Latest` | Date | Most recent date |
| `Checked` | Boolean | Count of true values |
| `Unchecked` | Boolean | Count of false values |
| `Count` | Any | Total number of values |
| `Empty` | Any | Count of empty values |
| `Filled` | Any | Count of non-empty values |
| `Unique` | Any | Count of unique values |

### Custom Summaries

You can use expressions for custom aggregations:

```yaml
summaries:
  price: 'values.filter(v => v > 0).length'
```

---

## Views Configuration

Views define how data is displayed. You can have multiple views per base:

```yaml
views:
  - type: table
    name: "Active Tasks"
    limit: 10
    filters:
      and:
        - 'status != "done"'
    sort:
      - property: priority
        direction: DESC
      - property: due_date
        direction: ASC
    groupBy:
      property: status
      direction: ASC
    summaries:
      priority: Average
```

### View Properties

| Property | Type | Description |
|----------|------|-------------|
| `type` | string | View type: `table`, `cards`, `list`, `map` |
| `name` | string | Display name for the view |
| `limit` | number | Maximum rows to show |
| `filters` | object | Additional filters (same syntax as base filters) |
| `order` | string[] | Column display order |
| `sort` | array | Sort configuration |
| `groupBy` | object | Group rows by property |
| `summaries` | object | View-specific summaries |

### Sort Configuration

```yaml
sort:
  - property: column_name
    direction: ASC   # or DESC
```

### GroupBy Configuration

```yaml
groupBy:
  property: status
  direction: ASC   # or DESC
```
