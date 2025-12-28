# Testing Links Tools

Tools: `get_outlinks`, `get_backlinks`, `find_orphans`, `find_broken_links`, `get_link_graph`

## Test 1: Get Outlinks from a Note

```
Get all outgoing links from "some-note.md"
```

Expected: Returns list of notes that this note links to (both [[wikilinks]] and [markdown](links)).

---

## Test 2: Get Backlinks to a Note

```
Find all notes that link to "some-note.md"
```

Expected: Returns list of notes containing links to the specified note.

---

## Test 3: Find Orphan Notes

```
Find all orphan notes in the vault (notes with no incoming or outgoing links)
```

Expected: Returns list of isolated notes not connected to others.

---

## Test 4: Find Broken Links

```
Find all broken links in the vault (links pointing to non-existent notes)
```

Expected: Returns list of broken links with source files.

---

## Test 5: Get Link Graph

```
Get the link graph for "some-note.md" with depth 1
```

Expected: Returns immediate connections (one hop away).

---

## Test 6: Get Link Graph (Deeper)

```
Get the link graph for "some-note.md" with depth 2
```

Expected: Returns connections up to 2 hops away.

---

## Test 7: Get Full Vault Graph

```
Get the complete link graph for the entire vault
```

Expected: Returns the full graph structure of all connections.

---

## Full Flow Test

```
Test link analysis:
1. Create three test notes:
   - "link-test-a.md" with content "# Note A\n\nLinks to [[link-test-b]]"
   - "link-test-b.md" with content "# Note B\n\nLinks to [[link-test-c]] and [[non-existent]]"
   - "link-test-c.md" with content "# Note C\n\nThis is a leaf node"
2. Get outlinks from "link-test-a.md" (should show link-test-b)
3. Get backlinks to "link-test-b.md" (should show link-test-a)
4. Find broken links (should find [[non-existent]])
5. Get the link graph for "link-test-a.md" with depth 2
6. Create an orphan note "link-test-orphan.md" with no links
7. Find orphan notes (should find the orphan)
8. Delete all test notes
```
