// Function to open PDF attachments
function openAttachment(itemId) {
    fetch(`/get_attachment/${itemId}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                console.log("Server response:", data);
                
                // If the server message indicates it opened the file, we're done
                if (data.message === 'File opened with system viewer') {
                    console.log("File opened with system viewer");
                    return;
                }
                
                // Try to open the PDF using different methods
                
                // Method 1: Using window.open with the file URL
                const pdfWindow = window.open(data.attachment_path, '_blank');
                
                // Method 2: If window.open fails or is blocked, create a temporary link and click it
                if (!pdfWindow || pdfWindow.closed || typeof pdfWindow.closed === 'undefined') {
                    const link = document.createElement('a');
                    link.href = data.attachment_path;
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                    link.click();
                }
                
                // Inform the user if both methods might have failed
                setTimeout(() => {
                    console.log("Attempted to open PDF. If it didn't open, the browser may be blocking popups.");
                }, 1000);
            } else {
                alert(data.message || 'Could not find attachment');
            }
        })
        .catch(error => {
            console.error('Error fetching attachment:', error);
            alert('Error retrieving attachment');
        });
}

// Function to initialize double-click handlers
function initializeItemDoubleClickHandlers() {
    // Get all item elements
    const itemElements = document.querySelectorAll('.item');
    
    // Add double-click event listener to each item
    itemElements.forEach(item => {
        item.addEventListener('dblclick', function(e) {
            // Don't trigger if clicking on a checkbox or button
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') {
                return;
            }
            
            // Get the item ID from the data attribute
            const itemId = this.getAttribute('data-item-id');
            if (itemId) {
                openAttachment(itemId);
            }
        });
    });
}

// Initialize the handlers when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeItemDoubleClickHandlers();
});