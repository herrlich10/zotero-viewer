// Function to highlight an item and display its details
function highlightItem(element, itemId) {
    // Remove highlight from all items
    document.querySelectorAll('.item').forEach(item => {
        item.classList.remove('highlighted');
    });
    
    // Add highlight to clicked item
    element.classList.add('highlighted');
    
    // Fetch item details
    fetch(`/get_item_details/${itemId}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                displayItemDetails(data.item);
            } else {
                console.error('Error fetching item details:', data.message);
            }
        })
        .catch(error => {
            console.error('Error:', error);
        });
}

// Function to display item details in the panel
function displayItemDetails(item) {
    const detailsContainer = document.getElementById('item-details-content');
    
    // Create HTML for the details
    let detailsHTML = `
        <div class="detail-title">${item.title}</div>
        <div class="detail-authors">
            ${Array.isArray(item.author) ? item.author.join(', ') : item.author}
        </div>
        <div class="detail-publication">${item.publication || ''}</div>
        <div class="detail-date">Published: ${item.date || 'No date'}</div>
    `;
    
    // Add tags before abstract - ensure no duplicates
    if (item.tags && item.tags.length > 0) {
        // Remove duplicate tags
        const uniqueTags = [...new Set(item.tags)];
        
        detailsHTML += `
            <div class="detail-tags">
                <h3>Tags</h3>
                <div class="detail-tags-list">
                    ${uniqueTags.map(tag => `
                        <span class="detail-tag">
                            ${tag}
                            <button type="button" class="close-tag" title="Remove tag" 
                                    onclick="removeTag('${tag}', ${item.id}, event)">&times;</button>
                        </span>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    // Add abstract if available
    if (item.abstract) {
        detailsHTML += `
            <div class="detail-abstract">
                <h3>Abstract</h3>
                <p>${item.abstract}</p>
            </div>
        `;
    }
    
    detailsContainer.innerHTML = detailsHTML;
}

// Initialize any event listeners when the DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Any additional initialization can go here
});