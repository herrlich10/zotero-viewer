// Function to process hierarchical tags and generate parent tags
function processHierarchicalTags(tags) {
    const allTags = new Set();
    
    tags.forEach(tag => {
        // Skip empty tags
        if (!tag) return;
        
        // Add the original tag
        allTags.add(tag);
        
        // If tag contains '/', generate parent tags
        if (tag.includes('/')) {
            const parts = tag.split('/');
            let currentPath = '';
            
            // Build each level of the hierarchy
            for (let i = 0; i < parts.length - 1; i++) {
                if (i === 0) {
                    currentPath = parts[0];
                } else {
                    currentPath = `${currentPath}/${parts[i]}`;
                }
                allTags.add(currentPath);
            }
        }
    });
    
    return Array.from(allTags);
}

// Function to add tags to selected items via AJAX
function addTagsToSelected(event) {
    event.preventDefault();
    
    const tagInput = document.querySelector('input[name="new_tag"]');
    const newTagsInput = tagInput.value.trim();
    
    if (!newTagsInput) {
        showFlashMessage('Please enter at least one tag name', 'error');
        return;
    }
    
    const checked = document.querySelectorAll('input[name="selected_items"]:checked');
    if (checked.length === 0) {
        showFlashMessage('Please select at least one item', 'error');
        return;
    }
    
    // Split tags by both comma and semicolon
    const tagArray = newTagsInput.split(/[,;]/).map(tag => tag.trim()).filter(tag => tag);
    
    // Process hierarchical tags to include parent tags
    const tagsToAdd = processHierarchicalTags(tagArray);
    
    // Create FormData to properly handle multiple values with the same name
    const formData = new FormData();
    
    // Add each tag (including parent tags) to the request
    tagsToAdd.forEach(tag => {
        formData.append('new_tag', tag);
    });
    
    // Add each selected item ID
    checked.forEach(checkbox => {
        formData.append('selected_items', checkbox.value);
    });
    
    // Get current URL parameters to pass to the server
    const currentUrl = new URL(window.location.href);
    const selectedTags = currentUrl.searchParams.getAll('tag');
    
    // Add the current selected tags to the request
    selectedTags.forEach(tag => {
        formData.append('selected_tags', tag);
    });
    
    // Use fetch API with FormData
    fetch("/add_tags", {
        method: 'POST',
        body: formData,
        headers: {
            'X-Requested-With': 'XMLHttpRequest'
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            // Show success message
            showFlashMessage(data.message, 'success');
            
            // Clear the input field
            tagInput.value = '';
            
            // Update the tag cloud with new counts
            if (data.tag_counts) {
                updateTagCloudWithSearchContext(data.tag_counts);
            }
            
            // Add the new tags to each selected item in the DOM
            if (data.added_tags && data.added_tags.length > 0) {
                checked.forEach(checkbox => {
                    const itemId = checkbox.value;
                    const item = document.getElementById(`item_${itemId}`).closest('.item');
                    const tagsContainer = item.querySelector('.item-tags');
                    
                    // Add each new tag if it doesn't already exist
                    data.added_tags.forEach(tagName => {
                        // Check if tag already exists
                        const existingTags = Array.from(tagsContainer.querySelectorAll('.tag'))
                            .map(tag => tag.childNodes[0].textContent.trim());
                        
                        if (!existingTags.includes(tagName)) {
                            const tagSpan = document.createElement('span');
                            tagSpan.className = 'tag';
                            tagSpan.innerHTML = `
                                ${tagName}
                                <button type="button" class="close-tag" title="Remove tag"
                                        onclick="removeTag('${tagName}', ${itemId}, event)">&times;</button>
                            `;
                            tagsContainer.appendChild(tagSpan);
                        }
                    });
                });
                
                // Update common tags display
                updateCommonTags();
                
                // Update the item details panel if the currently highlighted item is one of the selected items
                const highlightedItem = document.querySelector('.item.highlighted');
                if (highlightedItem) {
                    const highlightedItemId = highlightedItem.getAttribute('data-item-id');
                    const selectedItemIds = Array.from(checked).map(cb => cb.value);
                    
                    if (selectedItemIds.includes(highlightedItemId)) {
                        // Instead of manually updating the details panel, just re-fetch the item details
                        // This will use displayItemDetails which already handles duplicate tags
                        fetch(`/get_item_details/${highlightedItemId}`)
                            .then(response => response.json())
                            .then(data => {
                                if (data.success) {
                                    displayItemDetails(data.item);
                                }
                            })
                            .catch(error => {
                                console.error('Error refreshing item details:', error);
                            });
                    }
                }
            }
        } else {
            // Show error message
            showFlashMessage(data.message || 'Error adding tags', 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        // Check if the tag was actually added despite the error
        const tagInput = document.querySelector('input[name="new_tag"]');
        const newTagsInput = tagInput.value.trim();
        
        // If the input is now empty, it's likely the operation succeeded
        if (!newTagsInput) {
            showFlashMessage('Tags may have been added successfully despite network error', 'warning');
        } else {
            showFlashMessage('Network error while adding tags. Please try again.', 'error');
        }
    });
}

// Function to remove a tag from a single item
function removeTag(tagName, itemId, event) {
    // Add event parameter and check if it exists
    if (event) {
        // Prevent event propagation
        event.stopPropagation();
    }
    
    // Create FormData to properly handle the data
    const formData = new FormData();
    formData.append('tag_name', tagName);
    formData.append('item_id', itemId);
    
    // Get current URL parameters to pass to the server
    const currentUrl = new URL(window.location.href);
    const selectedTags = currentUrl.searchParams.getAll('tag');
    
    // Add the current selected tags to the request
    selectedTags.forEach(tag => {
        formData.append('selected_tags', tag);
    });
    
    // Use fetch API with FormData
    fetch("/remove_tag", {
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
            
            // Remove the tag from the DOM for the item
            const item = document.getElementById(`item_${itemId}`).closest('.item');
            const tagElements = item.querySelectorAll('.item-tags .tag');
            
            tagElements.forEach(tagEl => {
                if (tagEl.childNodes[0].textContent.trim() === tagName) {
                    tagEl.remove();
                }
            });
            
            // Update the tag cloud with new counts
            if (data.tag_counts) {
                updateTagCloudWithSearchContext(data.tag_counts);
            }
            
            // Update common tags if this item is selected
            const isItemSelected = document.getElementById(`item_${itemId}`).checked;
            if (isItemSelected) {
                updateCommonTags();
            }
            
            // Update the item details panel if this is the highlighted item
            const highlightedItem = document.querySelector('.item.highlighted');
            
            if (highlightedItem) {
                const highlightedItemId = highlightedItem.getAttribute('data-item-id');
                if (String(highlightedItemId) === String(itemId)) {
                    const detailsPanel = document.getElementById('item-details-content');
                    const detailTagElements = detailsPanel.querySelectorAll('.detail-tag');
                    
                    detailTagElements.forEach(tagEl => {
                        // More robust way to get the tag text
                        let tagText = '';
                        if (tagEl.childNodes.length > 0 && tagEl.childNodes[0].nodeType === Node.TEXT_NODE) {
                            tagText = tagEl.childNodes[0].textContent.trim();
                        } else {
                            tagText = tagEl.textContent.trim().replace(/×$/, ''); // Remove the × if present
                        }
                        
                        if (tagText === tagName) {
                            tagEl.remove();
                        }
                    });
                    
                    // If there are no more tags, hide the tags section
                    const remainingTags = detailsPanel.querySelectorAll('.detail-tag');
                    if (remainingTags.length === 0) {
                        const tagsSection = detailsPanel.querySelector('.detail-tags');
                        if (tagsSection) {
                            tagsSection.style.display = 'none';
                        }
                    }
                }
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
            alertDiv.textContent = data.message || 'Error removing tag';
            flashContainer.appendChild(alertDiv);
            
            // Auto-remove the flash message after 3 seconds
            setTimeout(() => {
                alertDiv.remove();
            }, 3000);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        
        // Show error message
        const flashContainer = document.querySelector('.flash-messages');
        const alertDiv = document.createElement('div');
        alertDiv.className = 'alert alert-error';
        alertDiv.textContent = 'Network error while removing tag';
        flashContainer.appendChild(alertDiv);
        
        // Auto-remove the flash message after 3 seconds
        setTimeout(() => {
            alertDiv.remove();
        }, 3000);
    });
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
                updateTagCloudWithSearchContext(data.tag_counts);
            }
            
            // Update the item details panel if the currently highlighted item is one of the selected items
            const highlightedItem = document.querySelector('.item.highlighted');
            if (highlightedItem) {
                const highlightedItemId = highlightedItem.getAttribute('data-item-id');
                if (selectedItemIds.includes(highlightedItemId)) {
                    // Find the tag in the details panel and remove it
                    const detailsPanel = document.getElementById('item-details-content');
                    const detailTagElements = detailsPanel.querySelectorAll('.detail-tag');
                    
                    detailTagElements.forEach(tagEl => {
                        const tagText = tagEl.childNodes[0].textContent.trim();
                        if (tagText === tagName) {
                            tagEl.remove();
                        }
                    });
                    
                    // If there are no more tags, hide the tags section
                    const remainingTags = detailsPanel.querySelectorAll('.detail-tag');
                    if (remainingTags.length === 0) {
                        const tagsSection = detailsPanel.querySelector('.detail-tags');
                        if (tagsSection) {
                            tagsSection.style.display = 'none';
                        }
                    }
                }
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

// Function to rename a tag
function renameTag(oldTagName) {
    const newTagName = prompt(`Rename tag "${oldTagName}" to:`, oldTagName);
    
    // If user cancels or enters the same name, do nothing
    if (!newTagName || newTagName === oldTagName || newTagName.trim() === '') {
        return;
    }
    
    // Send request to rename tag
    fetch('/rename_tag', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            old_tag_name: oldTagName,
            new_tag_name: newTagName.trim()
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Reload the page to show updated tags
            window.location.reload();
        } else {
            alert(data.message || 'Error renaming tag');
        }
    })
    .catch(error => {
        console.error('Error renaming tag:', error);
        alert('Error renaming tag');
    });
}

// Helper function to show flash messages
function showFlashMessage(message, type) {
    const flashContainer = document.querySelector('.flash-messages');
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    flashContainer.appendChild(alertDiv);
    
    // Auto-remove the flash message after 3 seconds
    setTimeout(() => {
        alertDiv.remove();
    }, 3000);
}