// Item search functionality
document.addEventListener('DOMContentLoaded', function() {
    // Get the search input element
    const searchInput = document.getElementById('item-search');
    
    // Add event listener for input changes
    searchInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase().trim();
        filterItems(searchTerm);
    });
    
    // Function to filter items based on search term
    function filterItems(searchTerm) {
        // Get all items
        const items = document.querySelectorAll('.item');
        
        // If search term is empty, show all items
        if (!searchTerm) {
            items.forEach(item => {
                item.style.display = '';
            });
            updateItemCount(items.length);
            return;
        }
        
        let visibleCount = 0;
        
        // Filter items based on search term
        items.forEach(item => {
            // Get all text content from the item
            const title = item.querySelector('.item-title')?.textContent.toLowerCase() || '';
            const author = item.querySelector('.item-author')?.textContent.toLowerCase() || '';
            const metadata = item.querySelector('.item-metadata')?.textContent.toLowerCase() || '';
            const tags = item.querySelector('.item-tags')?.textContent.toLowerCase() || '';
            
            // Get abstract from details panel if this is the highlighted item
            let abstract = '';
            if (item.classList.contains('highlighted')) {
                abstract = document.querySelector('.detail-abstract p')?.textContent.toLowerCase() || '';
            }
            
            // Combine all text content
            const allText = `${title} ${author} ${metadata} ${tags} ${abstract}`;
            
            // Show/hide item based on search term
            if (allText.includes(searchTerm)) {
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