// Item search functionality
document.addEventListener('DOMContentLoaded', function() {
    // Get the search input element
    const searchInput = document.getElementById('item-search');
    
    // Add event listener for input changes
    searchInput.addEventListener('input', function() {
        const searchValue = this.value.trim();
        filterItems(searchValue);
    });
    
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
            return;
        }
        
        // Split search value into terms using comma or semicolon as separator
        const searchTerms = searchValue.split(/[,;]/).map(term => term.trim().toLowerCase()).filter(term => term);
        
        let visibleCount = 0;
        
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
            } else {
                item.style.display = 'none';
            }
        });
        
        // Update the item count
        updateItemCount(visibleCount);
    }
    
    // Function to update the item count
    function updateItemCount(count) {
        const countElement = document.getElementById('item-count');
        if (countElement) {
            countElement.textContent = count;
        }
    }
    
    // Add clear search button functionality
    const clearSearchButton = document.getElementById('clear-search');
    if (clearSearchButton) {
        clearSearchButton.addEventListener('click', function() {
            searchInput.value = '';
            filterItems('');
            searchInput.focus();
        });
    }
});