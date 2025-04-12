import sqlite3
from flask import Flask, render_template, request, redirect, url_for, flash, jsonify
import sys, os
import re
from collections import defaultdict
import functools
from datetime import datetime
import click

# Create Flask application
app = Flask(__name__)
app.secret_key = os.environ.get('FLASK_SECRET_KEY') or os.urandom(24)

# Global variables
database_path = None
conn = None
all_items = []

def get_items_and_tags(connection):
    """Retrieve main items with metadata and tags using provided connection"""
    cursor = connection.cursor()
    
    # First, get basic item information without authors
    query = """
    SELECT
        items.itemID,
        itemDataValues.value AS title,
        dateValues.value AS date,
        items.dateAdded,
        publicationValues.value AS publication,
        abstractValues.value AS abstract,
        tags.name AS tag
    FROM items
    LEFT JOIN itemData ON items.itemID = itemData.itemID
    LEFT JOIN fields ON itemData.fieldID = fields.fieldID
    LEFT JOIN itemDataValues ON itemData.valueID = itemDataValues.valueID
    LEFT JOIN itemTags ON items.itemID = itemTags.itemID
    LEFT JOIN tags ON itemTags.tagID = tags.tagID
    
    -- Date field (publication date)
    LEFT JOIN itemData dateData ON items.itemID = dateData.itemID AND dateData.fieldID = 14
    LEFT JOIN itemDataValues dateValues ON dateData.valueID = dateValues.valueID
    
    -- Publication/Journal field
    LEFT JOIN itemData pubData ON items.itemID = pubData.itemID AND pubData.fieldID = 12
    LEFT JOIN itemDataValues publicationValues ON pubData.valueID = publicationValues.valueID
    
    -- Abstract field
    LEFT JOIN itemData abstractData ON items.itemID = abstractData.itemID AND abstractData.fieldID = 90
    LEFT JOIN itemDataValues abstractValues ON abstractData.valueID = abstractValues.valueID
    
    WHERE items.itemTypeID != 14  -- Exclude attachments
    AND (fields.fieldName = 'title' OR fields.fieldName IS NULL)
    """
    cursor.execute(query)
    
    items_dict = {}
    for row in cursor.fetchall():
        item_id = row['itemID']
        if item_id not in items_dict:
            # Format the date field to a readable format
            date = row['date']
            if date:
                datestr = date.split(' ')[0]
                Y, m, d = datestr.split('-')
                if m == '00' and d == '00':
                    date = Y
                elif d == '00':
                    date = f"{Y}-{m}"
                else:
                    date = f"{Y}-{m}-{d}"

            # Format the dateAdded field to a readable format
            date_added = row['dateAdded']
            if date_added:
                # Convert from Zotero's format (2023-01-01 12:00:00) to readable format
                try:
                    dt = datetime.strptime(date_added, '%Y-%m-%d %H:%M:%S')
                    date_added = dt.strftime('%Y-%m-%d %H:%M:%S')
                except:
                    # If parsing fails, keep the original format
                    pass
            
            items_dict[item_id] = {
                'id': item_id,
                'title': row['title'] or 'Untitled',
                'author': [],  # Initialize as empty list to store multiple authors
                'date': date or 'No date',
                'dateAdded': date_added or 'Unknown',
                'publication': row['publication'] or '',
                'abstract': row['abstract'] or '',  # Store abstract but don't display yet
                'tags': set()
            }
        if row['tag']:
            items_dict[item_id]['tags'].add(row['tag'])
    
    # Now get all authors for each item
    author_query = """
    SELECT
        items.itemID,
        creators.firstName,
        creators.lastName,
        creatorTypes.creatorType
    FROM items
    JOIN itemCreators ON items.itemID = itemCreators.itemID
    JOIN creators ON itemCreators.creatorID = creators.creatorID
    JOIN creatorTypes ON itemCreators.creatorTypeID = creatorTypes.creatorTypeID
    WHERE items.itemTypeID != 14  -- Exclude attachments
    ORDER BY items.itemID, itemCreators.orderIndex
    """
    cursor.execute(author_query)
    
    for row in cursor.fetchall():
        item_id = row['itemID']
        if item_id in items_dict:
            first_name = row['firstName'] or ''
            last_name = row['lastName'] or ''
            
            # Format the author name based on available parts
            if first_name and last_name:
                author_name = f"{first_name} {last_name}"
            elif last_name:
                author_name = last_name
            elif first_name:
                author_name = first_name
            else:
                author_name = "Unknown author"
                
            # Add the author to the list
            items_dict[item_id]['author'].append(author_name)
    
    # For items with no authors, set a default value
    for item in items_dict.values():
        if not item['author']:
            item['author'] = ['Unknown author']
    
    # Convert sets to lists for easier template handling
    for item in items_dict.values():
        item['tags'] = list(item['tags'])
    
    return list(items_dict.values())

# Decorator for database transactions
def with_transaction(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        conn = sqlite3.connect(database_path)
        conn.row_factory = sqlite3.Row
        try:
            result = func(conn, *args, **kwargs)  # Pass connection to wrapped function
            conn.commit()
            return result
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()
    return wrapper

# Update the add_tag_to_items function to use the connection passed by the decorator
@with_transaction
def add_tag_to_items(conn, tag_name, item_ids):  # Accept conn as first parameter
    cursor = conn.cursor()
    
    # Get or create tag
    cursor.execute("SELECT tagID FROM tags WHERE name = ?", (tag_name,))
    result = cursor.fetchone()
    if result:
        tag_id = result['tagID']
    else:
        cursor.execute("INSERT INTO tags (name) VALUES (?)", (tag_name,))
        tag_id = cursor.lastrowid

    # Insert associations using executemany for better performance
    existing_links = cursor.execute("""
        SELECT itemID, tagID FROM itemTags
        WHERE tagID = ? AND itemID IN ({})
        """.format(','.join('?'*len(item_ids))),
        [tag_id] + item_ids
    ).fetchall()

    existing_item_ids = {row['itemID'] for row in existing_links}
    new_associations = [
        (item_id, tag_id, 0)  # Adding default type value of 0
        for item_id in item_ids
        if int(item_id) not in existing_item_ids
    ]

    if new_associations:
        cursor.executemany(
            "INSERT INTO itemTags (itemID, tagID, type) VALUES (?, ?, ?)",
            new_associations
        )

    # Update in-memory data with fresh database state
    global all_items
    conn_refresh = sqlite3.connect(database_path)
    conn_refresh.row_factory = sqlite3.Row
    all_items = get_items_and_tags(conn_refresh)
    conn_refresh.close()

# Add a new function to remove tags from items
@with_transaction
def remove_tag_from_item(conn, tag_name, item_id):  # Accept conn as first parameter
    cursor = conn.cursor()
    
    # Get tag ID
    cursor.execute("SELECT tagID FROM tags WHERE name = ?", (tag_name,))
    result = cursor.fetchone()
    if not result:
        return False  # Tag doesn't exist
    
    tag_id = result['tagID']
    
    # Remove the association
    cursor.execute(
        "DELETE FROM itemTags WHERE itemID = ? AND tagID = ?",
        (item_id, tag_id)
    )
    
    # No need to update all_items here, we'll do it in the route handler
    
    return True

# Routes
@app.route('/', methods=['GET', 'POST'])
def index():
    if request.method == 'POST':
        new_tags_input = request.form.get('new_tag', '').strip()
        if not new_tags_input:
            flash('Please enter at least one tag name', 'error')
            return redirect(url_for('index'))
            
        # Split the input by comma or semicolon to get multiple tags
        new_tags = [tag.strip() for tag in re.split(r'[,;]', new_tags_input) if tag.strip()]
        
        if not new_tags:
            flash('Please enter valid tag names', 'error')
            return redirect(url_for('index'))
        
        # Get the form data directly from the request
        form_data = request.form
        selected_items = form_data.getlist('selected_items')
        print("selected_items:", selected_items)
        
        try:
            # Convert to integers
            selected_items = [int(item_id) for item_id in selected_items]
        except ValueError:
            flash('Invalid item selection', 'error')
            return redirect(url_for('index'))

        if not selected_items:
            flash('Please select at least one item', 'error')
            return redirect(url_for('index'))
        
        try:
            # Process each tag separately
            for tag_name in new_tags:
                add_tag_to_items(tag_name, selected_items)
            
            # Force reload all_items from database
            global all_items
            refresh_conn = sqlite3.connect(database_path)
            refresh_conn.row_factory = sqlite3.Row
            all_items = get_items_and_tags(refresh_conn)
            refresh_conn.close()
            
            if len(new_tags) == 1:
                flash(f'Added tag "{new_tags[0]}" to {len(selected_items)} items', 'success')
            else:
                flash(f'Added {len(new_tags)} tags to {len(selected_items)} items', 'success')
        except sqlite3.IntegrityError as e:
            flash(f'Database error: {str(e)}', 'error')
        except Exception as e:
            flash(f'Error: {str(e)}', 'error')
        return redirect(url_for('index'))
        
        # Check if this is an AJAX request
        is_ajax = request.headers.get('X-Requested-With') == 'XMLHttpRequest'
        
        # Return JSON response for AJAX requests
        if is_ajax:
            return jsonify({
                'success': True,
                'message': message,
                'tag_counts': dict(tag_counts)
            })
        else:
            return redirect(url_for('index'))
    else:
        # GET request handling remains unchanged
        selected_tags = request.args.getlist('tag')
        
        # Filter items that contain ALL selected tags
        filtered_items = [
            item for item in all_items
            if all(tag in item['tags'] for tag in selected_tags)
        ] if selected_tags else all_items
        
        # Create tag cloud with counts for current selection
        tag_counts = defaultdict(int)
        for item in filtered_items:
            for tag in item['tags']:
                tag_counts[tag] += 1
        
        return render_template(
            'index.html',
            items=filtered_items,
            tag_counts=tag_counts,
            selected_tags=selected_tags
        )

# Add a new route to handle tag removal
# Update the remove_tag route to return JSON
@app.route('/remove_tag', methods=['POST'])
def remove_tag():
    tag_name = request.form.get('tag_name')
    item_id = request.form.get('item_id')
    
    if not tag_name or not item_id:
        return jsonify({
            'success': False,
            'message': 'Missing tag name or item ID'
        })
    
    try:
        item_id = int(item_id)
        # The decorated function will receive conn as first parameter
        success = remove_tag_from_item(tag_name, item_id)
        
        if success:
            # Force reload of all items data from the database
            global all_items
            refresh_conn = sqlite3.connect(database_path)
            refresh_conn.row_factory = sqlite3.Row
            all_items = get_items_and_tags(refresh_conn)
            refresh_conn.close()
            
            # Get the current selected tags from the request
            selected_tags = request.form.getlist('selected_tags')
            
            # Filter items that contain ALL selected tags
            filtered_items = [
                item for item in all_items
                if all(tag in item['tags'] for tag in selected_tags)
            ] if selected_tags else all_items
            
            # Create tag cloud with counts for current selection
            tag_counts = defaultdict(int)
            for item in filtered_items:
                for tag in item['tags']:
                    tag_counts[tag] += 1
            
            return jsonify({
                'success': True,
                'message': f'Removed tag "{tag_name}" from item',
                'tag_counts': dict(tag_counts)
            })
        else:
            return jsonify({
                'success': False,
                'message': f'Tag "{tag_name}" not found'
            })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Error removing tag: {str(e)}'
        })

# Add a new route to handle batch tag removal
@app.route('/remove_tag_batch', methods=['POST'])
def remove_tag_batch():
    tag_name = request.form.get('tag_name')
    item_ids = request.form.getlist('item_ids')
    selected_tags = request.form.getlist('selected_tags')
    
    if not tag_name or not item_ids:
        return jsonify({
            'success': False,
            'message': 'Missing tag name or item IDs'
        })
    
    try:
        item_ids = [int(item_id) for item_id in item_ids]
        success_count = 0
        
        # Process each item ID
        for item_id in item_ids:
            if remove_tag_from_item(tag_name, item_id):
                success_count += 1
        
        # Force reload of all items data from the database
        global all_items
        refresh_conn = sqlite3.connect(database_path)
        refresh_conn.row_factory = sqlite3.Row
        all_items = get_items_and_tags(refresh_conn)
        refresh_conn.close()
        
        # Filter items that contain ALL selected tags
        filtered_items = [
            item for item in all_items
            if all(tag in item['tags'] for tag in selected_tags)
        ] if selected_tags else all_items
        
        # Create tag cloud with counts for current selection
        tag_counts = defaultdict(int)
        for item in filtered_items:
            for tag in item['tags']:
                tag_counts[tag] += 1
        
        if success_count > 0:
            return jsonify({
                'success': True,
                'message': f'Removed tag "{tag_name}" from {success_count} items',
                'tag_counts': dict(tag_counts)
            })
        else:
            return jsonify({
                'success': False,
                'message': f'Tag "{tag_name}" not found on selected items'
            })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Error removing tag: {str(e)}'
        })
    
    # Redirect back to the current page with any existing filter parameters
    return redirect(request.referrer or url_for('index'))

@app.route('/get_attachment/<item_id>')
def get_attachment(item_id):
    try:
        # Get the attachment path from the database
        attachment_path = get_attachment_path_for_item(item_id)

        if attachment_path and os.path.exists(attachment_path):
            # For local files, use file:// protocol with proper encoding
            # Ensure the path is properly formatted for URLs
            # Convert spaces to %20 and other special characters
            from urllib.parse import quote
            encoded_path = quote(attachment_path)
            file_url = f"file://{encoded_path}"
            
            # Try to open the file with the system default application
            try:
                import subprocess
                # Use 'open' command on macOS to open with default application
                subprocess.Popen(['open', attachment_path])
                return jsonify({
                    'success': True,
                    'message': 'File opened with system viewer',
                    'attachment_path': file_url,
                    'local_path': attachment_path
                })
            except Exception as open_error:
                print(f"Error opening file with system viewer: {str(open_error)}")
                # If system opening fails, return the URL for browser-side handling
                return jsonify({
                    'success': True,
                    'message': 'File found but could not open with system viewer',
                    'attachment_path': file_url,
                    'local_path': attachment_path
                })
        else:
            return jsonify({
                'success': False,
                'message': 'No attachment found for this item.'
            })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Error retrieving attachment: {str(e)}'
        })

# Use the with_transaction decorator like other functions
@with_transaction
def get_attachment_path_for_item(conn, item_id):
    """Get the file path for a PDF attachment associated with an item"""
    try:
        cursor = conn.cursor()
        
        # Query to find PDF attachments for the given item
        query = """
        SELECT
            items.key AS item_key,
            itemAttachments.path AS attachment_path,
            itemAttachments.contentType AS content_type,
            itemAttachments.linkMode AS link_mode
        FROM items
        JOIN itemAttachments ON items.itemID = itemAttachments.itemID
        WHERE itemAttachments.parentItemID = ?
        AND (itemAttachments.contentType = 'application/pdf' 
             OR itemAttachments.contentType LIKE '%pdf%'
             OR itemAttachments.path LIKE '%.pdf')
        LIMIT 1
        """
        
        cursor.execute(query, (item_id,))
        result = cursor.fetchone()
        
        if not result:
            print(f"No attachment found for item {item_id}")
            return None
        
        attachment_path = result['attachment_path']
        link_mode = result['link_mode']
        
        # Handle link_mode 2 (linked URL) - typically used by ZotFile with custom locations
        if link_mode == 2:
            # For ZotFile with link_mode 2, the path might be a file:// URL or a direct path
            if attachment_path.startswith('attachments:'):
                # Convert file:// URL to a file path
                file_path = attachment_path.replace('attachments:', os.path.expanduser("~")+'/')
                if os.path.exists(file_path):
                    return file_path
            
        # If we get here, we couldn't find the file
        print("Could not find attachment file")
        return None
        
    except Exception as e:
        print(f"Error getting attachment path: {str(e)}")
        return None
    # Remove the finally block that closes the connection
    # The with_transaction decorator will handle closing the connection

@app.route('/rename_tag', methods=['POST'])
def rename_tag():
    data = request.json
    old_tag_name = data.get('old_tag_name')
    new_tag_name = data.get('new_tag_name')
    
    if not old_tag_name or not new_tag_name:
        return jsonify({
            'success': False,
            'message': 'Missing old or new tag name'
        })
    
    try:
        # Create a new function to handle tag renaming
        success = rename_tag_in_database(old_tag_name, new_tag_name)
        
        if success:
            # Force reload of all items data from the database
            global all_items
            refresh_conn = sqlite3.connect(database_path)
            refresh_conn.row_factory = sqlite3.Row
            all_items = get_items_and_tags(refresh_conn)
            refresh_conn.close()
            
            return jsonify({
                'success': True,
                'message': f'Renamed tag "{old_tag_name}" to "{new_tag_name}"'
            })
        else:
            return jsonify({
                'success': False,
                'message': f'Tag "{old_tag_name}" not found'
            })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Error renaming tag: {str(e)}'
        })

@with_transaction
def rename_tag_in_database(conn, old_tag_name, new_tag_name):
    cursor = conn.cursor()
    
    # Check if the old tag exists
    cursor.execute("SELECT tagID FROM tags WHERE name = ?", (old_tag_name,))
    old_tag_result = cursor.fetchone()
    if not old_tag_result:
        return False  # Old tag doesn't exist
    
    old_tag_id = old_tag_result['tagID']
    
    # Check if the new tag already exists
    cursor.execute("SELECT tagID FROM tags WHERE name = ?", (new_tag_name,))
    new_tag_result = cursor.fetchone()
    
    if new_tag_result:
        # New tag already exists, need to merge tags
        new_tag_id = new_tag_result['tagID']
        
        # Get all items with the old tag
        cursor.execute("SELECT itemID FROM itemTags WHERE tagID = ?", (old_tag_id,))
        items_with_old_tag = [row['itemID'] for row in cursor.fetchall()]
        
        # For each item with the old tag, check if it already has the new tag
        for item_id in items_with_old_tag:
            cursor.execute("SELECT * FROM itemTags WHERE itemID = ? AND tagID = ?", 
                          (item_id, new_tag_id))
            if not cursor.fetchone():
                # Item doesn't have the new tag yet, add it
                cursor.execute("INSERT INTO itemTags (itemID, tagID, type) VALUES (?, ?, 0)",
                              (item_id, new_tag_id))
        
        # Delete all associations with the old tag
        cursor.execute("DELETE FROM itemTags WHERE tagID = ?", (old_tag_id,))
        
        # Delete the old tag
        cursor.execute("DELETE FROM tags WHERE tagID = ?", (old_tag_id,))
    else:
        # New tag doesn't exist, simply rename the old tag
        cursor.execute("UPDATE tags SET name = ? WHERE tagID = ?", 
                      (new_tag_name, old_tag_id))
    
    return True

@app.route('/get_item_details/<item_id>')
def get_item_details(item_id):
    try:
        # Find the item in our preloaded items
        item = next((item for item in all_items if str(item['id']) == str(item_id)), None)
        
        if item:
            return jsonify({
                'success': True,
                'item': item
            })
        else:
            return jsonify({
                'success': False,
                'message': 'Item not found'
            })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Error retrieving item details: {str(e)}'
        })

# Make sure to include the new JavaScript file in your template
# Add this to the bottom of your index.html before the closing </body> tag:
# <script src="{{ url_for('static', filename='js/item-details.js') }}"></script>

# Add a new route specifically for AJAX tag addition
@app.route('/add_tags', methods=['POST'])
def add_tags():
    new_tags_input = request.form.getlist('new_tag')
    selected_items = request.form.getlist('selected_items')
    selected_tags = request.form.getlist('selected_tags')
    
    if not new_tags_input:
        return jsonify({
            'success': False,
            'message': 'Please enter at least one tag name'
        })
    
    # Process the tags (they're already split in JavaScript)
    new_tags = [tag.strip() for tag in new_tags_input if tag.strip()]
    
    if not new_tags:
        return jsonify({
            'success': False,
            'message': 'Please enter valid tag names'
        })
    
    try:
        # Convert to integers
        selected_items = [int(item_id) for item_id in selected_items]
    except ValueError:
        return jsonify({
            'success': False,
            'message': 'Invalid item selection'
        })

    if not selected_items:
        return jsonify({
            'success': False,
            'message': 'Please select at least one item'
        })
    
    try:
        # Process each tag separately
        for tag_name in new_tags:
            add_tag_to_items(tag_name=tag_name, item_ids=selected_items)
        
        # Force reload all_items from database
        global all_items
        refresh_conn = sqlite3.connect(database_path)
        refresh_conn.row_factory = sqlite3.Row
        all_items = get_items_and_tags(refresh_conn)
        
        # Filter items that contain ALL selected tags
        filtered_items = [
            item for item in all_items
            if all(tag in item['tags'] for tag in selected_tags)
        ] if selected_tags else all_items
        
        # Create tag cloud with counts for current selection
        tag_counts = defaultdict(int)
        for item in filtered_items:
            for tag in item['tags']:
                tag_counts[tag] += 1
        
        refresh_conn.close()
        
        # Create success message
        if len(new_tags) == 1:
            message = f'Added tag "{new_tags[0]}" to {len(selected_items)} items'
        else:
            message = f'Added {len(new_tags)} tags to {len(selected_items)} items'
        
        return jsonify({
            'success': True,
            'message': message,
            'tag_counts': dict(tag_counts),
            'added_tags': new_tags
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Error: {str(e)}'
        })

# Add a new route to handle data refresh
@app.route('/refresh_data', methods=['POST'])
def refresh_data():
    try:
        # Force reload of all items data from the database
        global all_items
        refresh_conn = sqlite3.connect(database_path)
        refresh_conn.row_factory = sqlite3.Row
        all_items = get_items_and_tags(refresh_conn)
        refresh_conn.close()
        
        # Get the current selected tags from the request
        selected_tags = request.form.getlist('selected_tags')
        
        # If this is an AJAX request, return JSON response
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return jsonify({
                'success': True,
                'message': 'Data refreshed successfully'
            })
        
        # Otherwise redirect back to the index with any selected tags
        if selected_tags:
            return redirect(url_for('index', tag=selected_tags))
        else:
            return redirect(url_for('index'))
            
    except Exception as e:
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return jsonify({
                'success': False,
                'message': f'Error refreshing data: {str(e)}'
            })
        flash(f'Error refreshing data: {str(e)}', 'error')
        return redirect(url_for('index'))


@click.command()
@click.argument('database', type=click.Path(exists=True))
@click.option('--host', default='127.0.0.1', help='Host to bind the server to (default: 127.0.0.1)')
@click.option('--port', default=5000, help='Port to bind the server to (default: 5000)')
@click.option('--debug', is_flag=True, help='Run in debug mode (default: False)')
def main(database, host, port, debug):
    """Run the Zotero Viewer web application.
    
    DATABASE: Path to your Zotero SQLite database file (required)
    
    Example usage:
    
    zotero-viewer /path/to/zotero.sqlite
    
    zotero-viewer /path/to/zotero.sqlite --host 0.0.0.0 --port 8080 --debug
    """
    global database_path, conn, all_items
    
    database_path = database
    conn = sqlite3.connect(database_path)
    conn.row_factory = sqlite3.Row
    
    # Load all items at startup
    all_items = get_items_and_tags(conn)
    
    # Run the Flask app
    app.run(host=host, port=port, debug=debug)

@app.route('/api/tags')
def get_all_tags():
    """API endpoint to get all tags from the database"""
    # Get all unique tags from the database
    all_tags = set()
    
    # Extract tags from the already loaded items
    for item in all_items:
        if 'tags' in item:
            for tag in item['tags']:
                all_tags.add(tag)
    
    # Sort tags alphabetically
    sorted_tags = sorted(list(all_tags))
    
    return jsonify({'tags': sorted_tags})

if __name__ == '__main__':
    main()
