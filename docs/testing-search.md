# Testing Search Tools

Tools: `search_vault`

## Test 1: Basic Text Search

```
Search for "TODO" across all notes in the vault
```

Expected: Returns files containing "TODO" with matching lines highlighted.

---

## Test 2: Search in Specific Folder

```
Search for "project" only in the "Projects" folder
```

Expected: Returns matches only from notes in the specified folder.

---

## Test 3: Case-Sensitive Search

```
Search for "README" with case-sensitivity enabled
```

Expected: Finds only exact case matches (README, not readme or Readme).

---

## Test 4: Case-Insensitive Search (Default)

```
Search for "readme" without case-sensitivity
```

Expected: Finds README, readme, Readme, etc.

---

## Test 5: Search with Limited Results

```
Search for "the" but limit results to 5 files
```

Expected: Returns at most 5 matching files.

---

## Test 6: Search for Multi-Word Phrase

```
Search for "meeting notes" in the vault
```

Expected: Finds notes containing the exact phrase "meeting notes".

---

## Test 7: Search for Common Patterns

```
Search for "[[" to find all wiki-style links in the vault
```

Expected: Returns notes that contain internal links.

---

## Full Flow Test

```
Test search functionality:
1. First, create a test note called "search-test.md" with content that includes: TODO, FIXME, meeting notes, and some [[internal links]]
2. Search for "TODO" and verify the test note appears
3. Search for "FIXME" case-sensitively
4. Search for "meeting" in the vault
5. Delete the test note when done
```
