// Define utility functions in the global scope for reuse
// Function to update tag cloud based on visible items
function updateTagCloudForVisibleItems(visibleItems) {
    // If null is passed, it means show all tags (no filtering)
    if (visibleItems === null) {
        // Call the global function to reset tag cloud
        if (typeof resetTagCloudVisibility === 'function') {
            resetTagCloudVisibility();
        }
        return;
    }
    
    // Collect all tags from visible items and count their occurrences
    const visibleTags = new Set();
    const tagCounts = {};
    
    visibleItems.forEach(item => {
        const tagElements = item.querySelectorAll('.item-tags .tag');
        tagElements.forEach(tagEl => {
            // Get only the text content of the tag, excluding the close button
            const tagText = tagEl.childNodes[0].textContent.trim();
            visibleTags.add(tagText);
            
            // Count occurrences of each tag
            if (!tagCounts[tagText]) {
                tagCounts[tagText] = 1;
            } else {
                tagCounts[tagText]++;
            }
        });
    });
    
    // Call the global function to update tag cloud visibility with counts
    if (typeof updateTagCloudVisibility === 'function') {
        updateTagCloudVisibility(visibleTags, tagCounts);
    }
}

// Function to update the item count
function updateItemCount(count) {
    const countElement = document.getElementById('item-count');
    if (countElement) {
        countElement.textContent = count;
    }
}

// Function to filter items based on search terms
function filterItems(searchValue) {
    // Get all items
    const items = document.querySelectorAll('.item');
    
    // If search value is empty, show all items
    if (!searchValue) {
        items.forEach(item => {
            item.style.display = '';
        });
        updateItemCount(items.length);
        
        // Update tag cloud to show all tags
        updateTagCloudForVisibleItems(null);
        
        // Explicitly trigger tag sorting when search is cleared
        const tagSort = document.getElementById('tag-sort');
        if (tagSort) {
            setTimeout(() => {
                tagSort.dispatchEvent(new Event('change'));
            }, 10);
        }
        return;
    }
    
    // Split search value into terms using comma or semicolon as separator
    const searchTerms = searchValue.split(/[,;]/).map(term => term.trim().toLowerCase()).filter(term => term);
    
    let visibleCount = 0;
    let visibleItems = [];
    
    // Filter items based on search terms (AND relation)
    items.forEach(item => {
        // Get all text content from the item
        const title = item.querySelector('.item-title')?.textContent.toLowerCase() || '';
        const author = item.querySelector('.item-author')?.textContent.toLowerCase() || '';
        const metadata = item.querySelector('.item-metadata')?.textContent.toLowerCase() || '';
        const tags = item.querySelector('.item-tags')?.textContent.toLowerCase() || '';
        
        // Get abstract from details panel if this is the highlighted item
        let abstract = '';
        if (item.classList.contains('highlighted')) {
            abstract = document.querySelector('.detail-abstract')?.textContent.toLowerCase() || '';
        }
        
        // Combine all text content
        const allText = `${title} ${author} ${metadata} ${tags} ${abstract}`;
        
        // Check if ALL search terms are found in the item (AND relation)
        const allTermsFound = searchTerms.every(term => allText.includes(term));
        
        // Show/hide item based on search results
        if (allTermsFound) {
            item.style.display = '';
            visibleCount++;
            visibleItems.push(item);
        } else {
            item.style.display = 'none';
        }
    });
    
    // Update the item count
    updateItemCount(visibleCount);
    
    // Update tag cloud to only show tags from visible items
    updateTagCloudForVisibleItems(visibleItems);
}

// Item search functionality
document.addEventListener('DOMContentLoaded', function() {
    // Get the search input element
    const searchInput = document.getElementById('item-search');
    
    if (!searchInput) return;
    
    // Add event listener for input changes
    searchInput.addEventListener('input', function() {
        const searchValue = this.value.trim();
        filterItems(searchValue);
    });
    
    // Add clear search button functionality
    const clearSearchButton = document.getElementById('clear-search');
    if (clearSearchButton) {
        clearSearchButton.addEventListener('click', function() {
            searchInput.value = '';
            filterItems('');  // This already includes the tag sorting trigger
            searchInput.focus();
        });
    }
});