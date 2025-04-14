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
    
    // Save current search value before page reload
    const searchInput = document.getElementById('item-search');
    if (searchInput && searchInput.value) {
        // Store the search value in localStorage
        localStorage.setItem('savedSearchValue', searchInput.value);
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
        
        // Get all tags that aren't hidden by search
        const availableTags = Array.from(tagCloud.getElementsByClassName('tag')).filter(tag => 
            !tag.hasAttribute('data-hidden-by-search')
        );
        
        // If filter is empty, show all available tags
        if (!filterText) {
            availableTags.forEach(tag => {
                tag.style.display = '';
                tag.classList.remove('tag-highlight');
            });
            
            // Trigger sort when clearing the filter
            newTagSort.dispatchEvent(new Event('change'));
        } else {
            // Apply filter to available tags
            availableTags.forEach(tag => {
                const tagText = tag.textContent.toLowerCase();
                if (tagText.includes(filterText)) {
                    tag.style.display = '';
                    tag.classList.add('tag-highlight');
                } else {
                    tag.style.display = 'none';
                }
            });
            
            // Re-sort after filtering
            newTagSort.dispatchEvent(new Event('change'));
        }
        
        // Update tag count to show only visible tags after filtering
        updateVisibleTagCount();
    });
    
    // Sort tags
    newTagSort.addEventListener('change', function() {
        const sortMethod = this.value;
        
        // Only sort tags that are currently visible
        const visibleTags = Array.from(tags).filter(tag => 
            tag.style.display !== 'none'
        );

        visibleTags.sort((a, b) => {
            if (sortMethod === 'alpha') {
                // Sort alphabetically
                return a.textContent.localeCompare(b.textContent);
            } else {
                // Sort by count - use the current displayed count, not the original data-count
                const countA = parseInt(a.textContent.trim().match(/\((\d+)\)$/)[1]);
                const countB = parseInt(b.textContent.trim().match(/\((\d+)\)$/)[1]);
                return countB - countA; // Descending order
            }
        });
        
        // Re-append sorted tags
        visibleTags.forEach(tag => {
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

// New function to update tag cloud visibility based on visible items
function updateTagCloudVisibility(visibleTags, tagCounts) {
    const tagCloud = document.getElementById('tag-cloud');
    if (!tagCloud) return;
    
    const tagElements = tagCloud.querySelectorAll('.tag');
    let visibleTagCount = 0;
    
    tagElements.forEach(tagEl => {
        // Extract tag name (without the count)
        const tagText = tagEl.textContent.trim();
        const tagName = tagText.replace(/\s*\(\d+\)$/, '');
        
        // Show/hide based on whether this tag is in the visible tags set
        if (visibleTags.has(tagName)) {
            tagEl.style.display = '';
            tagEl.removeAttribute('data-hidden-by-search');
            visibleTagCount++;
            
            // Update the tag count to reflect visible items
            if (tagCounts && tagCounts[tagName] !== undefined) {
                tagEl.textContent = `${tagName} (${tagCounts[tagName]})`;
            }
        } else {
            tagEl.style.display = 'none';
            tagEl.setAttribute('data-hidden-by-search', 'true');
        }
    });
    
    // Update tag count after search filtering
    updateVisibleTagCount();
    
    // Re-sort tags based on current sort method
    const tagSort = document.getElementById('tag-sort');
    if (tagSort) {
        tagSort.dispatchEvent(new Event('change'));
    }
}

// New function to reset tag cloud visibility (show all tags)
function resetTagCloudVisibility() {
    const tagCloud = document.getElementById('tag-cloud');
    if (!tagCloud) return;
    
    const tagElements = tagCloud.querySelectorAll('.tag');
    
    tagElements.forEach(tagEl => {
        tagEl.style.display = '';
        tagEl.removeAttribute('data-hidden-by-search');
        
        // Restore original count from data-count attribute
        // trim() is important here to avoid duplicated count problem
        const tagName = tagEl.textContent.trim().replace(/\s*\(\d+\)$/, '');
        const originalCount = tagEl.getAttribute('data-count');
        if (originalCount) {
            tagEl.textContent = `${tagName} (${originalCount})`;
        }
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
    
    // Update tag count after resetting visibility
    updateVisibleTagCount();
}

// New function to update the visible tag count
function updateVisibleTagCount() {
    const tagCloud = document.getElementById('tag-cloud');
    if (!tagCloud) return;
    
    const visibleTags = Array.from(tagCloud.querySelectorAll('.tag')).filter(tag => 
        tag.style.display !== 'none'
    );
    
    const tagCountElement = document.getElementById('tag-count');
    if (tagCountElement) {
        tagCountElement.textContent = visibleTags.length;
    }
}

// Function to handle the select all checkbox functionality
function initializeSelectAllCheckbox() {
    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    const selectAllLabel = document.querySelector('label[for="select-all-checkbox"]');
    const itemCheckboxes = document.querySelectorAll('input[name="selected_items"]');
    
    if (!selectAllCheckbox || itemCheckboxes.length === 0) return;
    
    // Update select all checkbox state based on visible item checkboxes
    function updateSelectAllCheckbox() {
        // Only count visible items
        const visibleCheckboxes = Array.from(itemCheckboxes).filter(checkbox => 
            checkbox.closest('.item').style.display !== 'none'
        );
        
        const checkedVisibleCount = visibleCheckboxes.filter(checkbox => checkbox.checked).length;
        
        if (visibleCheckboxes.length === 0) {
            // No visible items
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
        } else if (checkedVisibleCount === 0) {
            // None selected
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
        } else if (checkedVisibleCount === visibleCheckboxes.length) {
            // All visible selected
            selectAllCheckbox.checked = true;
            selectAllCheckbox.indeterminate = false;
        } else {
            // Some visible selected
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
        
        // Only update visible checkboxes
        itemCheckboxes.forEach(checkbox => {
            const item = checkbox.closest('.item');
            if (item.style.display !== 'none') {
                checkbox.checked = shouldCheck;
            }
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
                
                // Only update visible checkboxes
                itemCheckboxes.forEach(checkbox => {
                    const item = checkbox.closest('.item');
                    if (item.style.display !== 'none') {
                        checkbox.checked = shouldCheck;
                    }
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
    
    // Restore search value from localStorage if it exists
    const searchInput = document.getElementById('item-search');
    if (searchInput && localStorage.getItem('savedSearchValue')) {
        searchInput.value = localStorage.getItem('savedSearchValue');
        
        // Make sure the item-search.js has loaded before triggering the search
        setTimeout(() => {
            // Trigger the input event to apply the search
            searchInput.dispatchEvent(new Event('input'));
            
            // Clear the saved search value after it's been applied
            localStorage.removeItem('savedSearchValue');
        }, 100);
    }
});

// Add this new function after updateTagCloud function
function updateTagCloudWithSearchContext(tagCounts) {
    // First, check if there's an active search
    const searchInput = document.getElementById('item-search');
    const hasActiveSearch = searchInput && searchInput.value.trim() !== '';
    
    if (hasActiveSearch) {
        // If there's an active search, we need to filter the tag counts
        // to only include tags from visible items
        const visibleItems = Array.from(document.querySelectorAll('.item'))
            .filter(item => item.style.display !== 'none');
        
        // Update tag cloud with visibility constraints from search
        updateTagCloud(tagCounts);
        updateTagCloudForVisibleItems(visibleItems);
    } else {
        // If no active search, just update normally
        updateTagCloud(tagCounts);
    }
}