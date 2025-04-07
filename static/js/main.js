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
    if (checked.length === 0) {
        document.getElementById('common-tags-container').style.display = 'none';
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
    const commonTagsContainer = document.getElementById('common-tags-container');
    const commonTagsList = document.getElementById('common-tags-list');
    
    if (commonTags.length > 0) {
        commonTagsContainer.style.display = 'flex';
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
        commonTagsContainer.style.display = 'none';
    }
}

// Function to remove a tag from all selected items
function removeTagFromSelected(tagName) {
    const checked = document.querySelectorAll('input[name="selected_items"]:checked');
    const selectedItemIds = Array.from(checked).map(checkbox => checkbox.value);
    
    // Create FormData to properly handle multiple values with the same name
    const formData = new FormData();
    formData.append('tag_name', tagName);
    
    // Add each item ID separately
    selectedItemIds.forEach(itemId => {
        formData.append('item_ids', itemId);
    });
    
    // Get current URL parameters to pass to the server
    const currentUrl = new URL(window.location.href);
    const selectedTags = currentUrl.searchParams.getAll('tag');
    
    // Add the current selected tags to the request
    selectedTags.forEach(tag => {
        formData.append('selected_tags', tag);
    });
    
    // Use fetch API with FormData
    fetch("/remove_tag_batch", {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Show success message without page reload
            const flashContainer = document.querySelector('.flash-messages');
            const alertDiv = document.createElement('div');
            alertDiv.className = 'alert alert-success';
            alertDiv.textContent = data.message;
            flashContainer.appendChild(alertDiv);
            
            // Remove the tag from the DOM for each selected item
            selectedItemIds.forEach(itemId => {
                const item = document.getElementById(`item_${itemId}`).closest('.item');
                const tagElements = item.querySelectorAll('.item-tags .tag');
                
                tagElements.forEach(tagEl => {
                    if (tagEl.childNodes[0].textContent.trim() === tagName) {
                        tagEl.remove();
                    }
                });
            });
            
            // Update common tags display
            updateCommonTags();
            
            // Update the tag cloud with new counts
            if (data.tag_counts) {
                updateTagCloud(data.tag_counts);
            }
            
            // Auto-remove the flash message after 3 seconds
            setTimeout(() => {
                alertDiv.remove();
            }, 3000);
        } else {
            // Show error message
            const flashContainer = document.querySelector('.flash-messages');
            const alertDiv = document.createElement('div');
            alertDiv.className = 'alert alert-error';
            alertDiv.textContent = data.message;
            flashContainer.appendChild(alertDiv);
        }
    })
    .catch(error => {
        console.error('Error:', error);
    });
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

// Initialize everything when the DOM is loaded
// Function to handle the select all checkbox functionality
function initializeSelectAllCheckbox() {
    const selectAllCheckbox = document.getElementById('select-all-checkbox');
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
    
    // Replace click with mousedown event which happens before the checkbox state changes
    selectAllCheckbox.addEventListener('mousedown', function() {
        // Determine what action to take based on current state
        const shouldCheck = !this.checked && !this.indeterminate;
        
        // Set all checkboxes to the new state
        itemCheckboxes.forEach(checkbox => {
            checkbox.checked = shouldCheck;
        });
        
        // Set the select-all checkbox state
        setTimeout(() => {
            this.checked = shouldCheck;
            this.indeterminate = false;
            
            // Update common tags display
            updateCommonTags();
        }, 0);
    });
    
    // Add event listeners to individual checkboxes
    itemCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            updateSelectAllCheckbox();
            // No need to call updateCommonTags here as it's already attached to checkboxes
        });
    });
    
    // Initialize the state
    updateSelectAllCheckbox();
}

// Update the DOMContentLoaded event handler to include the new function
document.addEventListener('DOMContentLoaded', function() {
    initializeTagFilterAndSort();
    
    const checkboxes = document.querySelectorAll('input[name="selected_items"]');
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', updateCommonTags);
    });
    
    // Initialize select all checkbox
    initializeSelectAllCheckbox();
});


// Function to remove a tag from a single item
function removeTag(tagName, itemId) {
    // Create a form dynamically
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = "/remove_tag";
    
    // Add tag name input
    const tagInput = document.createElement('input');
    tagInput.type = 'hidden';
    tagInput.name = 'tag_name';
    tagInput.value = tagName;
    form.appendChild(tagInput);
    
    // Add item id input
    const itemInput = document.createElement('input');
    itemInput.type = 'hidden';
    itemInput.name = 'item_id';
    itemInput.value = itemId;
    form.appendChild(itemInput);
    
    // Add form to body, submit it, and remove it
    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
}