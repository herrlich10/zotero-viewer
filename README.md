# Zotero Viewer

A powerful web-based viewer for Zotero references that enhances your Zotero library with advanced tagging, searching, and browsing capabilities.

## Why Zotero Viewer?

While the official Zotero desktop application provides excellent reference management, Zotero Viewer adds several key features that make working with large reference collections more efficient:

- **Advanced tag management**: Easily add, remove, and rename tags across multiple references at once
- **Hierachial tags support**: The parent tag auto-addition approach provides hierarchical tags support even back in the native Zotero app
- **Powerful search capabilities**: Search across titles, authors, abstracts, and tags with fine-grained control

Besides these, Zotero Viewer also offers standard features like:

- **Tag autocompletion**: Quickly add new tags by typing and selecting from suggestions
- **Intuitive tag filtering**: Filter your references by selecting multiple tags with AND logic
- **Flexible sorting options**: Sort your references by title, author, year, journal, or date added
- **Attachment handling**: Quickly access PDF attachments associated with your references
- **Clean, responsive interface**: Browse your references in a modern web interface

## What Zotero Viewer Cannot Do

While Zotero Viewer enhances your Zotero experience in many ways, it's important to understand its limitations:

- **No Reference Editing**: Zotero Viewer is read-only for bibliographic data. You cannot edit reference metadata like titles, authors, or publication details.
- **No Reference Creation**: You cannot add new references through Zotero Viewer. Use the Zotero desktop app for adding new items.
- **No Attachment Management**: While you can view attachments, you cannot add, remove, or rename attachment files.
- **No Collection Management**: Zotero's collections are not represented in the viewer.
- **No Note Editing**: Zotero notes are not accessible or editable in the viewer.
- **No Sync Functionality**: Zotero Viewer does not sync with Zotero servers. It only reads from your local Zotero database.
- **No Citation Management**: Features related to citation styles, bibliography generation, or word processor integration are not available.

Zotero Viewer is designed to complement the Zotero desktop application, not replace it. For full reference management capabilities, you should continue to use the official Zotero application.

## Disclaimer

**Use at Your Own Risk**: Zotero Viewer is an unofficial tool that directly interacts with your Zotero database. While it's designed to be safe and read-only for most bibliographic data:

- Always back up your Zotero database before using this tool
- This software contains AI-generated code components which, while tested, may have unforeseen behaviors
- Tag operations modify your Zotero database and could potentially cause issues
- The developers are not responsible for any data loss or corruption

The location of your Zotero database backup can typically be found at:
- macOS: `/Users/[username]/Zotero/zotero.sqlite`
- Windows: `C:\Users\[username]\Zotero\zotero.sqlite`
- Linux: `/home/[username]/Zotero/zotero.sqlite`

**Important**: In principle, Zotero Viewer and the Zotero desktop application should not be used simultaneously with the same database file in order to avoid potential collisions. 

In practice, based on limited testing, Zotero app can start up normally even when Zotero Viewer is running, and see the latest changes made by Zotero Viewer (as these changes are applied immediately to the database). When Zotero app is launched, the database is unlocked, and the Zotero Viewer can no longer access it until the app is closed. A data refresh (not web page refresh) is required to see the latest changes. However, it is not guaranteed that the two can always work properly, especially when the same item is edited by both at the same time.

## Installation

```bash
pip install zotero-viewer
```

## Usage

```bash
zotero-viewer /path/to/your/zotero.sqlite
```

Optional parameters:
- `--host`: Host to bind the server to (default: 127.0.0.1)
- `--port`: Port to bind the server to (default: 5000)
- `--debug`: Run in debug mode (default: False)

Example with custom settings:
```bash
zotero-viewer /path/to/your/zotero.sqlite --host 0.0.0.0 --port 8080 --debug
```

After starting the server, open your web browser and navigate to `http://localhost:5000` (or the custom port you specified).

## Key Features

### Tag Management

#### Batch Tag Assignment

1. Select multiple references using the checkboxes
2. Enter one or more tags in the "Add tags" input field (separate multiple tags with commas or semicolons)
3. Click "Add Tags to Selected" to apply the tags to all selected references

#### Batch Tag Removal

1. When multiple references are selected, the "Common tags" section shows tags that appear in all selected references
2. Click the close button of a tag in the "Common tags" section to remove it from all selected references

#### Hierarchical Tags

Zotero Viewer supports hierarchical tags using the parent tag auto-addition approach. This means that when you add a hierarchical tag like `Attention/Spatial` to a reference, the parent tags (`Attention`) are automatically added. The major advantage of this approach is that it requires no schema changes to the Zotero database but allows filtering by parent tags even in the native Zotero app.

- Tags are considered hierarchical when they use the format `parent/child` or `parent/child/grandchild`
- When you add a child tag (e.g., `parent/child/grandchild`), the parent tags (`parent` and `parent/child`) are automatically added
- This hierarchical structure is fully compatible with Zotero's desktop application
- You can filter by any level in the hierarchy - selecting a parent tag will show all items with that tag or any of its children
- The tag cloud (when sort alphabetically) visually groups related tags, making it easier to navigate large tag collections

#### Tag Renaming

1. Right-click on any tag in the sidebar to rename it
2. Enter the new tag name in the input field and press Enter

### Searching

The search bar allows for powerful searching across your references:

- **Words separated by spaces** are treated as a single quoted term (exact phrase matching)
- **Terms separated by commas or semicolons** use AND logic (all terms must match)

Examples:
- `machine learning` - Finds references containing the exact phrase "machine learning"
- `neural, network` - Finds references containing both "neural" AND "network" (in any location)
- `deep learning; python` - Finds references containing both "deep learning" AND "python"

### Sorting

Click on any of the sort options (Title, Author, Year, Journal, Added Date) to reorder your references. Click again to toggle between ascending and descending order.

### Reference Details

Click on any reference to view its complete details in the right panel, including abstract and attachment information.

### Attachment Handling

Double-click on any reference to open its associated PDF attachment in the system's default PDF viewer.

### Tips and Tricks

- Use the tag filter input in the sidebar to quickly find specific tags in large libraries
- The "Select All" checkbox allows you to quickly select all currently visible references
- Clear all tag filters by clicking the "Clear All Filters" button
- Use the search function in combination with tag filtering for highly specific queries

## License

MIT