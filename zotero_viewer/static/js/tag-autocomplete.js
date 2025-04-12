// Tag autocomplete functionality
document.addEventListener('DOMContentLoaded', function() {
    const tagInput = document.getElementById('new-tag-input');
    const tagSuggestions = document.getElementById('tag-suggestions');
    
    if (!tagInput || !tagSuggestions) return;
    
    // Store all tags from the database
    let allTags = [];
    
    // Fetch all tags from the server when the page loads
    fetchAllTags();
    
    // Function to fetch all tags from the server
    function fetchAllTags() {
        fetch('/api/tags')
            .then(response => response.json())
            .then(data => {
                allTags = data.tags;
            })
            .catch(error => {
                console.error('Error fetching tags:', error);
            });
    }
    
    // Current input state
    let currentInput = '';
    let selectedSuggestionIndex = -1;
    
    // Show suggestions based on current input
    function showSuggestions(input) {
        // Clear previous suggestions
        tagSuggestions.innerHTML = '';
        
        // If input is empty, hide suggestions
        if (!input.trim()) {
            tagSuggestions.style.display = 'none';
            return;
        }
        
        // Filter tags that match the input
        const inputLower = input.toLowerCase().trim();
        const matchingTags = allTags.filter(tag => {
            const tagLower = tag.toLowerCase();
            // Include tag if it contains the input text but is not an exact case-insensitive match
            // Don't suggest exact matches
            return tagLower.includes(inputLower) && tag !== input;
        });
        
        // If no matches, hide suggestions
        if (matchingTags.length === 0) {
            tagSuggestions.style.display = 'none';
            return;
        }
        
        // Add matching tags to suggestions
        matchingTags.forEach((tag, index) => {
            const suggestion = document.createElement('div');
            suggestion.className = 'tag-suggestion';
            suggestion.textContent = tag;
            suggestion.dataset.index = index;
            
            suggestion.addEventListener('click', function() {
                applySuggestion(tag);
            });
            
            tagSuggestions.appendChild(suggestion);
        });
        
        // Show suggestions
        tagSuggestions.style.display = 'block';
        selectedSuggestionIndex = -1;
    }
    
    // Apply the selected suggestion
    function applySuggestion(suggestion) {
        // Get current input value
        const inputValue = tagInput.value;
        
        // Find the position of the last delimiter
        const lastCommaPos = inputValue.lastIndexOf(',');
        const lastSemicolonPos = inputValue.lastIndexOf(';');
        const lastDelimiterPos = Math.max(lastCommaPos, lastSemicolonPos);
        
        // Determine which delimiter was used (default to comma)
        const delimiter = lastSemicolonPos > lastCommaPos ? ';' : ',';
        
        // Create new input value with the suggestion
        let newValue;
        if (lastDelimiterPos === -1) {
            // No delimiter, replace entire input
            newValue = suggestion;
        } else {
            // Replace text after the last delimiter
            const beforeDelimiter = inputValue.substring(0, lastDelimiterPos + 1);
            newValue = beforeDelimiter + ' ' + suggestion;
        }
        
        // Update input value
        tagInput.value = newValue;
        
        // Hide suggestions
        tagSuggestions.style.display = 'none';
        
        // Focus input and move cursor to end
        tagInput.focus();
    }
    
    // Handle input changes
    tagInput.addEventListener('input', function() {
        // Get current input value
        const inputValue = this.value;
        
        // Find the position of the last delimiter
        const lastCommaPos = inputValue.lastIndexOf(',');
        const lastSemicolonPos = inputValue.lastIndexOf(';');
        const lastDelimiterPos = Math.max(lastCommaPos, lastSemicolonPos);
        
        // Get the text after the last delimiter
        let currentTag;
        if (lastDelimiterPos === -1) {
            // No delimiter, use entire input
            currentTag = inputValue.trim();
        } else {
            // Use text after the last delimiter
            currentTag = inputValue.substring(lastDelimiterPos + 1).trim();
        }
        
        // Update current input
        currentInput = currentTag;
        
        // Show suggestions
        showSuggestions(currentTag);
    });
    
    // Handle keyboard navigation
    tagInput.addEventListener('keydown', function(e) {
        // Only handle if suggestions are visible
        if (tagSuggestions.style.display !== 'block') return;
        
        const suggestions = tagSuggestions.querySelectorAll('.tag-suggestion');
        
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                // Move selection down
                selectedSuggestionIndex = Math.min(selectedSuggestionIndex + 1, suggestions.length - 1);
                updateSelectedSuggestion();
                break;
                
            case 'ArrowUp':
                e.preventDefault();
                // Move selection up
                selectedSuggestionIndex = Math.max(selectedSuggestionIndex - 1, -1);
                updateSelectedSuggestion();
                break;
                
            case 'Enter':
                // If a suggestion is selected, apply it
                if (selectedSuggestionIndex >= 0 && selectedSuggestionIndex < suggestions.length) {
                    e.preventDefault();
                    applySuggestion(suggestions[selectedSuggestionIndex].textContent);
                }
                break;
                
            case 'Escape':
                // Hide suggestions
                tagSuggestions.style.display = 'none';
                break;
                
            case 'Tab':
                // If a suggestion is selected, apply it
                if (selectedSuggestionIndex >= 0 && selectedSuggestionIndex < suggestions.length) {
                    e.preventDefault();
                    applySuggestion(suggestions[selectedSuggestionIndex].textContent);
                } else if (suggestions.length > 0) {
                    // Apply first suggestion if none selected
                    e.preventDefault();
                    applySuggestion(suggestions[0].textContent);
                }
                break;
        }
    });
    
    // Update the selected suggestion
    function updateSelectedSuggestion() {
        const suggestions = tagSuggestions.querySelectorAll('.tag-suggestion');
        
        // Remove selected class from all suggestions
        suggestions.forEach(suggestion => {
            suggestion.classList.remove('selected');
        });
        
        // Add selected class to current selection
        if (selectedSuggestionIndex >= 0 && selectedSuggestionIndex < suggestions.length) {
            suggestions[selectedSuggestionIndex].classList.add('selected');
            // Ensure the selected suggestion is visible
            suggestions[selectedSuggestionIndex].scrollIntoView({ block: 'nearest' });
        }
    }
    
    // Hide suggestions when clicking outside
    document.addEventListener('click', function(e) {
        if (!tagInput.contains(e.target) && !tagSuggestions.contains(e.target)) {
            tagSuggestions.style.display = 'none';
        }
    });
});