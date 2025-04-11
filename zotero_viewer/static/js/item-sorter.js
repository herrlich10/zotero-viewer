// Item sorting functionality
document.addEventListener('DOMContentLoaded', function() {
    // Get all sort labels
    const sortLabels = document.querySelectorAll('.sort-label');
    
    // Store original label text to avoid accumulating arrows
    const originalLabelText = {};
    sortLabels.forEach(label => {
        originalLabelText[label.getAttribute('data-sort')] = label.textContent;
    });
    
    // Current sort state - initialize with dateAdded and desc direction
    let currentSort = {
        field: 'dateAdded',
        direction: 'desc'
    };
    
    // Add click event to each sort label
    sortLabels.forEach(label => {
        label.addEventListener('click', function(e) {
            e.preventDefault();
            
            const sortField = this.getAttribute('data-sort');
            
            // If clicking the same field, toggle direction
            if (currentSort.field === sortField) {
                currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
            } else {
                // New field, set to ascending by default
                currentSort.field = sortField;
                if (sortField === 'dateAdded' || sortField === 'year') {
                    currentSort.direction = 'desc';
                } else {
                    currentSort.direction = 'asc';
                }
            }
            
            // Update UI to show active sort
            updateSortUI(sortField, currentSort.direction);
            
            // Perform the sorting
            sortItems(sortField, currentSort.direction);
        });
    });
    
    // Function to update the UI to show active sort
    function updateSortUI(field, direction) {
        // Remove active class and reset text for all labels
        sortLabels.forEach(label => {
            label.classList.remove('active');
            const labelField = label.getAttribute('data-sort');
            label.textContent = originalLabelText[labelField];
        });
        
        // Add active class and icon to the current sort label
        const activeLabel = document.querySelector(`.sort-label[data-sort="${field}"]`);
        if (activeLabel) {
            activeLabel.classList.add('active');
            const icon = direction === 'asc' ? '↑' : '↓';
            activeLabel.textContent = `${originalLabelText[field]} ${icon}`;
        }
    }
    
    // Function to sort the items
    function sortItems(field, direction) {
        // const itemsContainer = document.querySelector('.main-content');
        const itemsContainer = document.querySelector('.items-container');
        const items = Array.from(document.querySelectorAll('.item'));
        
        items.sort((a, b) => {
            let valueA, valueB;
            
            // Extract values based on the field
            if (field === 'title') {
                valueA = a.querySelector('.item-title').textContent.trim().toLowerCase();
                valueB = b.querySelector('.item-title').textContent.trim().toLowerCase();
            } else if (field === 'author') {
                // Get full author text
                const authorTextA = a.querySelector('.item-author').textContent.trim();
                const authorTextB = b.querySelector('.item-author').textContent.trim();
                
                // Extract last name for sorting
                // For multiple authors, use the first author's last name
                const getLastName = (authorText) => {
                    // If there are multiple authors (separated by comma)
                    if (authorText.includes(',')) {
                        // Get the first author
                        authorText = authorText.split(',')[0].trim();
                    }
                    
                    // Split by spaces and get the last part as the last name
                    const parts = authorText.split(' ');
                    return parts[parts.length - 1].toLowerCase();
                };
                
                valueA = getLastName(authorTextA);
                valueB = getLastName(authorTextB);
            } else if (field === 'year') {
                // Extract year from date if available
                const dateTextA = a.querySelector('.item-metadata').textContent;
                const dateTextB = b.querySelector('.item-metadata').textContent;
                
                const yearMatchA = dateTextA.match(/Published: (\d{4})/);
                const yearMatchB = dateTextB.match(/Published: (\d{4})/);
                
                valueA = yearMatchA ? parseInt(yearMatchA[1]) : 0;
                valueB = yearMatchB ? parseInt(yearMatchB[1]) : 0;
            } else if (field === 'publication') {
                // Extract publication name
                const metaA = a.querySelector('.item-metadata').textContent.trim();
                const metaB = b.querySelector('.item-metadata').textContent.trim();
                
                // Get text before the first pipe if it exists
                valueA = metaA.split('|')[0].trim().toLowerCase();
                valueB = metaB.split('|')[0].trim().toLowerCase();
            } else if (field === 'dateAdded') {
                // Extract added date
                const metaA = a.querySelector('.item-metadata').textContent;
                const metaB = b.querySelector('.item-metadata').textContent;
                
                const dateMatchA = metaA.match(/Added: ([^|]+)/);
                const dateMatchB = metaB.match(/Added: ([^|]+)/);
                
                // Parse dates more reliably
                if (dateMatchA && dateMatchB) {
                    // Convert to date objects for comparison
                    valueA = new Date(dateMatchA[1].trim());
                    valueB = new Date(dateMatchB[1].trim());
                    
                    // If date parsing failed, use string comparison as fallback
                    if (isNaN(valueA.getTime()) || isNaN(valueB.getTime())) {
                        valueA = dateMatchA[1].trim();
                        valueB = dateMatchB[1].trim();
                    }
                } else {
                    // Handle cases where one or both items don't have added dates
                    valueA = dateMatchA ? new Date(dateMatchA[1].trim()) : new Date(0);
                    valueB = dateMatchB ? new Date(dateMatchB[1].trim()) : new Date(0);
                }
            }
            
            // Compare values based on direction
            if (direction === 'asc') {
                if (field === 'dateAdded' && valueA instanceof Date && valueB instanceof Date) {
                    return valueA.getTime() - valueB.getTime();
                }
                return valueA > valueB ? 1 : -1;
            } else {
                if (field === 'dateAdded' && valueA instanceof Date && valueB instanceof Date) {
                    return valueB.getTime() - valueA.getTime();
                }
                return valueA < valueB ? 1 : -1;
            }
        });
        
        // Reappend items in sorted order
        items.forEach(item => {
            itemsContainer.appendChild(item);
        });
    }
    
    // Apply default sort on page load (dateAdded, desc)
    updateSortUI('dateAdded', 'desc');
    sortItems('dateAdded', 'desc');
});