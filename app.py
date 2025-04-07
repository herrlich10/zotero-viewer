import sqlite3
from flask import Flask, render_template, request, redirect, url_for, flash, jsonify
import sys, os
import re  # Add this import for regex splitting
from collections import defaultdict
import functools

# Connect to database
if len(sys.argv) < 2:
    print("Usage: python app.py /path/to/zotero.sqlite")
    sys.exit(1)

database_path = sys.argv[1]
conn = sqlite3.connect(database_path)
conn.row_factory = sqlite3.Row

def get_items_and_tags(connection):
    """Retrieve main items with metadata and tags using provided connection"""
    cursor = connection.cursor()
    query = """
    SELECT
        items.itemID,
        itemDataValues.value AS title,
        creators.firstName || ' ' || creators.lastName AS author,
        dateValues.value AS date,
        tags.name AS tag
    FROM items
    LEFT JOIN itemData ON items.itemID = itemData.itemID
    LEFT JOIN fields ON itemData.fieldID = fields.fieldID
    LEFT JOIN itemDataValues ON itemData.valueID = itemDataValues.valueID
    LEFT JOIN itemCreators ON items.itemID = itemCreators.itemID
    LEFT JOIN creators ON itemCreators.creatorID = creators.creatorID
    LEFT JOIN itemTags ON items.itemID = itemTags.itemID
    LEFT JOIN tags ON itemTags.tagID = tags.tagID
    LEFT JOIN itemData dateData ON items.itemID = dateData.itemID AND dateData.fieldID = 14  -- Date field
    LEFT JOIN itemDataValues dateValues ON dateData.valueID = dateValues.valueID
    WHERE items.itemTypeID != 14  -- Exclude attachments
    AND (fields.fieldName = 'title' OR fields.fieldName IS NULL)
    """
    cursor.execute(query)
    
    items_dict = {}
    for row in cursor.fetchall():
        item_id = row['itemID']
        if item_id not in items_dict:
            items_dict[item_id] = {
                'id': item_id,
                'title': row['title'] or 'Untitled',
                'author': row['author'] or 'Unknown author',
                'date': row['date'] or 'No date',
                'tags': set()
            }
        if row['tag']:
            items_dict[item_id]['tags'].add(row['tag'])
    
    # Convert sets to lists for easier template handling
    for item in items_dict.values():
        item['tags'] = list(item['tags'])
    return list(items_dict.values())

# Preload all items and tags
all_items = get_items_and_tags(conn)

# Modify the with_transaction decorator
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


app = Flask(__name__)
app.secret_key = os.environ.get('FLASK_SECRET_KEY') or os.urandom(24)  # Best practice

# Update the route to handle POST with multiple tags
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
# Fix the remove_tag route
@app.route('/remove_tag', methods=['POST'])
def remove_tag():
    tag_name = request.form.get('tag_name')
    item_id = request.form.get('item_id')
    
    if not tag_name or not item_id:
        flash('Missing tag name or item ID', 'error')
        return redirect(url_for('index'))
    
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
            
            flash(f'Removed tag "{tag_name}" from item', 'success')
        else:
            flash(f'Tag "{tag_name}" not found', 'error')
    except Exception as e:
        flash(f'Error removing tag: {str(e)}', 'error')
    
    # Redirect back to the current page with any existing filter parameters
    return redirect(request.referrer or url_for('index'))

# Add a new route to handle batch tag removal
@app.route('/remove_tag_batch', methods=['POST'])
def remove_tag_batch():
    tag_name = request.form.get('tag_name')
    item_ids = request.form.getlist('item_ids')
    
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
        
        # Get updated tag counts for the current filter
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

if __name__ == '__main__':
    app.run(debug=True)