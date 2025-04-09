// Function to toggle tag selection in the URL
function toggleTag(tagName) {
    const url = new URL(window.location.href);
    const params = url.searchParams;
    const tags = params.getAll('tag');
    
    if (tags.includes(tagName)) {
        // Remove tag if already selected
        const newTags = tags.filter(tag => tag !== tagName);
        params.delete('tag');
        newTags.forEach(tag => params.append('tag', tag));
    } else {
        // Add tag if not selected
        params.append('tag', tagName);
    }
    
    // Update URL and reload page
    url.search = params.toString();
    window.location.href = url.toString();
}

// Function to update common tags display
function updateCommonTags() {
    const checked = document.querySelectorAll('input[name="selected_items"]:checked');
    const commonTagsContainer = document.getElementById('common-tags-container');
    
    if (checked.length === 0) {
        commonTagsContainer.classList.remove('active');
        return;
    }
    
    // Get all selected item IDs
    const selectedItemIds = Array.from(checked).map(checkbox => checkbox.value);
    
    // Find common tags among selected items
    const allItemTags = {};
    selectedItemIds.forEach(itemId => {
        const item = document.getElementById(`item_${itemId}`).closest('.item');
        const tagElements = item.querySelectorAll('.item-tags .tag');
        
        if (!allItemTags[itemId]) {
            allItemTags[itemId] = [];
        }
        
        tagElements.forEach(tagEl => {
            // Get only the text content of the tag, excluding the close button
            const tagText = tagEl.childNodes[0].textContent.trim();
            allItemTags[itemId].push(tagText);
        });
    });
    
    // Find tags that exist in all selected items
    let commonTags = [];
    if (selectedItemIds.length > 0) {
        commonTags = [...allItemTags[selectedItemIds[0]]];
        for (let i = 1; i < selectedItemIds.length; i++) {
            commonTags = commonTags.filter(tag => 
                allItemTags[selectedItemIds[i]].includes(tag)
            );
        }
    }
    
    // Update the common tags display
    const commonTagsList = document.getElementById('common-tags-list');
    
    if (commonTags.length > 0) {
        commonTagsContainer.classList.add('active');
        commonTagsList.innerHTML = '';
        
        commonTags.forEach(tag => {
            const tagSpan = document.createElement('span');
            tagSpan.className = 'common-tag';
            tagSpan.innerHTML = `
                ${tag}
                <button type="button" class="remove-common-tag" 
                        onclick="removeTagFromSelected('${tag}')">&times;</button>
            `;
            commonTagsList.appendChild(tagSpan);
        });
    } else {
        commonTagsContainer.classList.remove('active');
    }
}

// Function to update the tag cloud
function updateTagCloud(tagCounts) {
    const tagCloud = document.getElementById('tag-cloud');
    const selectedTags = new URLSearchParams(window.location.search).getAll('tag');
    const tagSort = document.getElementById('tag-sort');
    const tagFilter = document.getElementById('tag-filter');
    
    // Remember current sort method
    const currentSortMethod = tagSort.value;
    
    // Remember current filter text
    const currentFilterText = tagFilter.value.toLowerCase();
    
    // Clear existing tags
    tagCloud.innerHTML = '';
    
    // Add updated tags - only those with counts > 0 will be in tagCounts
    Object.entries(tagCounts).forEach(([tag, count]) => {
        // Skip tags with zero count
        if (count === 0) return;
        
        const tagDiv = document.createElement('div');
        tagDiv.className = 'tag';
        if (selectedTags.includes(tag)) {
            tagDiv.classList.add('selected-tag');
        }
        tagDiv.setAttribute('data-count', count);
        tagDiv.textContent = `${tag} (${count})`;
        tagDiv.onclick = function() { toggleTag(tag); };
        
        // Add right-click functionality for tag renaming
        tagDiv.setAttribute('title', 'Right-click to rename');
        tagDiv.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            const tagText = this.textContent.trim();
            const tagName = tagText.replace(/\s*\(\d+\)$/, '');
            renameTag(tagName);
        });
        
        // Apply current filter
        if (currentFilterText && !tag.toLowerCase().includes(currentFilterText)) {
            tagDiv.style.display = 'none';
        }
        
        tagCloud.appendChild(tagDiv);
    });
    
    // Re-apply sorting
    const tags = Array.from(tagCloud.getElementsByClassName('tag'));
    tags.sort((a, b) => {
        if (currentSortMethod === 'alpha') {
            // Sort alphabetically
            return a.textContent.localeCompare(b.textContent);
        } else {
            // Sort by count
            const countA = parseInt(a.getAttribute('data-count'));
            const countB = parseInt(b.getAttribute('data-count'));
            return countB - countA; // Descending order
        }
    });
    
    // Re-append tags in sorted order
    tags.forEach(tag => {
        tagCloud.appendChild(tag);
    });
    
    // Re-initialize event listeners for tag filter and sort
    initializeTagFilterAndSort();
}

// Function to initialize tag filter and sort
function initializeTagFilterAndSort() {
    const tagFilter = document.getElementById('tag-filter');
    const tagSort = document.getElementById('tag-sort');
    const tagCloud = document.getElementById('tag-cloud');
    const tags = Array.from(tagCloud.getElementsByClassName('tag'));
    
    // Remove existing event listeners
    const newTagFilter = tagFilter.cloneNode(true);
    tagFilter.parentNode.replaceChild(newTagFilter, tagFilter);
    
    const newTagSort = tagSort.cloneNode(true);
    tagSort.parentNode.replaceChild(newTagSort, tagSort);
    
    // Re-add event listeners
    newTagFilter.addEventListener('input', function() {
        const filterText = this.value.toLowerCase();
        
        tags.forEach(tag => {
            const tagText = tag.textContent.toLowerCase();
            if (tagText.includes(filterText)) {
                tag.style.display = '';
                // Highlight matching part
                if (filterText) {
                    tag.classList.add('tag-highlight');
                } else {
                    tag.classList.remove('tag-highlight');
                }
            } else {
                tag.style.display = 'none';
            }
        });
    });
    
    // Sort tags
    newTagSort.addEventListener('change', function() {
        const sortMethod = this.value;
        
        tags.sort((a, b) => {
            if (sortMethod === 'alpha') {
                // Sort alphabetically
                return a.textContent.localeCompare(b.textContent);
            } else {
                // Sort by count
                const countA = parseInt(a.getAttribute('data-count'));
                const countB = parseInt(b.getAttribute('data-count'));
                return countB - countA; // Descending order
            }
        });
        
        // Re-append sorted tags
        tags.forEach(tag => {
            tagCloud.appendChild(tag);
        });
    });
    
    // Preserve the current filter value
    if (tagFilter.value) {
        newTagFilter.value = tagFilter.value;
        newTagFilter.dispatchEvent(new Event('input'));
    }
    
    // Preserve the current sort method
    newTagSort.value = tagSort.value;
    newTagSort.dispatchEvent(new Event('change'));
}

// Function to handle the select all checkbox functionality
function initializeSelectAllCheckbox() {
    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    const selectAllLabel = document.querySelector('label[for="select-all-checkbox"]');
    const itemCheckboxes = document.querySelectorAll('input[name="selected_items"]');
    
    if (!selectAllCheckbox || itemCheckboxes.length === 0) return;
    
    // Update select all checkbox state based on item checkboxes
    function updateSelectAllCheckbox() {
        const checkedCount = document.querySelectorAll('input[name="selected_items"]:checked').length;
        
        if (checkedCount === 0) {
            // None selected
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
        } else if (checkedCount === itemCheckboxes.length) {
            // All selected
            selectAllCheckbox.checked = true;
            selectAllCheckbox.indeterminate = false;
        } else {
            // Some selected
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = true;
        }
    }
    
    // Handle the checkbox click directly
    selectAllCheckbox.addEventListener('click', function(e) {
        // Explicitly register to this event and preventDefault here is critical 
        // to prevent the default checkbox click behavior to sneak in after the mousedown event.
        e.preventDefault();
    });

    // Handle the mousedown event which happens before the click event
    selectAllCheckbox.addEventListener('mousedown', function(e) {
        e.preventDefault();
                
        // Toggle based on current state
        const shouldCheck = !selectAllCheckbox.checked && !selectAllCheckbox.indeterminate;
        
        // Update all checkboxes
        itemCheckboxes.forEach(checkbox => {
            checkbox.checked = shouldCheck;
        });
        
        // Update the select-all checkbox state
        selectAllCheckbox.checked = shouldCheck;
        selectAllCheckbox.indeterminate = false;
        
        // Update common tags display
        updateCommonTags();
    });
    
    // Handle label click separately
    if (selectAllLabel) {
        selectAllLabel.addEventListener('click', function(e) {
            // Only handle if clicking directly on the label (not the checkbox)
            if (e.target !== selectAllCheckbox) {
                e.preventDefault();
                
                // Toggle based on current state
                const shouldCheck = !selectAllCheckbox.checked && !selectAllCheckbox.indeterminate;
                
                // Update all checkboxes
                itemCheckboxes.forEach(checkbox => {
                    checkbox.checked = shouldCheck;
                });
                
                // Update the select-all checkbox state
                selectAllCheckbox.checked = shouldCheck;
                selectAllCheckbox.indeterminate = false;
                
                // Update common tags display
                updateCommonTags();
            }
        });
    }
    
    // Add event listeners to individual checkboxes
    itemCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            updateSelectAllCheckbox();
        });
    });
    
    // Initialize the state
    updateSelectAllCheckbox();
}

// New function to update tag cloud visibility based on visible items
function updateTagCloudVisibility(visibleTags) {
    const tagCloud = document.getElementById('tag-cloud');
    if (!tagCloud) return;
    
    const tagElements = tagCloud.querySelectorAll('.tag');
    
    tagElements.forEach(tagEl => {
        // Extract tag name (without the count)
        const tagText = tagEl.textContent.trim();
        const tagName = tagText.replace(/\s*\(\d+\)$/, '');
        
        // Show/hide based on whether this tag is in the visible tags set
        if (visibleTags.has(tagName)) {
            tagEl.style.display = '';
        } else {
            tagEl.style.display = 'none';
        }
    });
}

// New function to reset tag cloud visibility (show all tags)
function resetTagCloudVisibility() {
    const tagCloud = document.getElementById('tag-cloud');
    if (!tagCloud) return;
    
    const tagElements = tagCloud.querySelectorAll('.tag');
    
    tagElements.forEach(tagEl => {
        tagEl.style.display = '';
    });
    
    // Re-apply any existing tag filter
    const tagFilter = document.getElementById('tag-filter');
    if (tagFilter && tagFilter.value) {
        const filterText = tagFilter.value.toLowerCase();
        
        tagElements.forEach(tag => {
            const tagText = tag.textContent.toLowerCase();
            if (!tagText.includes(filterText)) {
                tag.style.display = 'none';
            }
        });
    }
}

// Add this single consolidated DOMContentLoaded event listener at the end of the file:
document.addEventListener('DOMContentLoaded', function() {
    // Initialize tag filter and sort
    initializeTagFilterAndSort();
    
    // Initialize checkboxes for common tags
    const checkboxes = document.querySelectorAll('input[name="selected_items"]');
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', updateCommonTags);
    });
    
    // Initialize select all checkbox
    initializeSelectAllCheckbox();
    
    // Add event listener to the add tags form
    const addTagForm = document.getElementById('add-tag-form');
    if (addTagForm) {
        addTagForm.addEventListener('submit', addTagsToSelected);
    }
    
    // Initialize context menu for tags in the tag cloud
    const tagCloudTags = document.querySelectorAll('#tag-cloud .tag');
    tagCloudTags.forEach(tag => {
        // Update title attribute to indicate right-click functionality
        tag.setAttribute('title', 'Right-click to rename');
        
        // Add context menu (right-click) event listener
        tag.addEventListener('contextmenu', function(e) {
            // Prevent the default context menu
            e.preventDefault();
            
            // Get the tag name (remove the count in parentheses)
            const tagText = this.textContent.trim();
            const tagName = tagText.replace(/\s*\(\d+\)$/, '');
            
            // Call the rename function
            renameTag(tagName);
        });
    });
});