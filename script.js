// TMDB API Configuration
const API_KEY = 'd64f0ecf30a298852d82fac294b62f45';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';
const AUTH_HEADER = { 'Authorization': `Bearer ${API_KEY}` };

// DOM Elements
const searchInput = document.querySelector('.search-input');
const searchResults = document.querySelector('.search-results');
const typeButtons = document.querySelectorAll('.type-btn');
const tierContents = document.querySelectorAll('.tier-content');
const exportTableBtn = document.getElementById('export-table');
const importDataBtn = document.getElementById('import-data');
const clearAllBtn = document.getElementById('clear-all');
const fileInput = document.getElementById('file-input');
const toast = document.getElementById('toast');
const themeToggle = document.getElementById('theme-toggle');
const editModeBtn = document.getElementById('edit-mode-btn');

// State
let currentSearchType = 'movie';
let isEditMode = false;

// Initialize application
document.addEventListener('DOMContentLoaded', initApp);

function initApp() {
    // Initialize empty states
    initEmptyStates();

    // Theme toggle
    themeToggle.addEventListener('click', toggleTheme);
    loadThemePreference();

    // Search functionality
    searchInput.addEventListener('input', debounce(handleSearch, 300));

    // Search type buttons
    typeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            typeButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentSearchType = btn.dataset.type;
            searchInput.placeholder = currentSearchType === 'movie'
                ? 'Search for movies or TV shows...'
                : 'Search for actors...';
            searchInput.value = '';
            searchResults.classList.remove('active');
        });
    });

    // Edit mode toggle
    editModeBtn.addEventListener('click', toggleEditMode);

    // Drag and drop functionality
    setupDragAndDrop();

    // Export/Import functionality
    exportTableBtn.addEventListener('click', exportTable);
    importDataBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', importData);
    clearAllBtn.addEventListener('click', clearAllData);

    // Load data from localStorage if available
    loadFromLocalStorage();

    // Close search results when clicking outside
    document.addEventListener('click', function(e) {
        if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
            searchResults.classList.remove('active');
        }
    });
}

// Initialize empty states for tier contents
function initEmptyStates() {
    tierContents.forEach(container => {
        showEmptyState(container);
    });
}

// Theme functions
function toggleTheme() {
    document.body.classList.toggle('light-theme');

    const isLight = document.body.classList.contains('light-theme');
    localStorage.setItem('themePreference', isLight ? 'light' : 'dark');
    updateThemeToggle(isLight ? 'light' : 'dark');
}

function loadThemePreference() {
    const savedTheme = localStorage.getItem('themePreference');
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
        updateThemeToggle('light');
    } else {
        updateThemeToggle('dark');
    }
}

function updateThemeToggle(theme) {
    const icon = themeToggle.querySelector('i');
    const text = themeToggle.querySelector('span');

    if (theme === 'light') {
        icon.className = 'fas fa-sun';
        text.textContent = 'Light';
    } else {
        icon.className = 'fas fa-moon';
        text.textContent = 'Dark';
    }
}

// Edit mode toggle
function toggleEditMode() {
    isEditMode = !isEditMode;

    const allCards = document.querySelectorAll('.movie-card');

    if (isEditMode) {
        editModeBtn.classList.add('active');
        editModeBtn.querySelector('span').textContent = 'Edit Mode: On';
        allCards.forEach(card => card.classList.add('edit-mode'));
        showToast('Edit mode activated - Click cards to remove them');
    } else {
        editModeBtn.classList.remove('active');
        editModeBtn.querySelector('span').textContent = 'Edit Mode: Off';
        allCards.forEach(card => card.classList.remove('edit-mode'));
    }
}

// Search functionality
async function handleSearch() {
    const query = searchInput.value.trim();

    if (query.length < 2) {
        searchResults.classList.remove('active');
        searchResults.innerHTML = '';
        return;
    }

    try {
        const endpoint = currentSearchType === 'movie'
            ? '/search/multi'
            : '/search/person';

        const response = await fetch(`${BASE_URL}${endpoint}?api_key=${API_KEY}&query=${encodeURIComponent(query)}&include_adult=false`);

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();

        // Process results
        let results = [];
        if (data && data.results) {
            // Filter results for movie search type
            results = currentSearchType === 'movie'
                ? data.results.filter(item => item && (item.media_type === 'movie' || item.media_type === 'tv'))
                : data.results;

            // Limit to 5 results
            results = results.slice(0, 5);
        }

        if (results.length === 0) {
            searchResults.innerHTML = '<p style="padding: 10px; text-align: center;">No results found</p>';
        } else {
            renderSearchResults(results);
        }

        searchResults.classList.add('active');
    } catch (error) {
        console.error('Error searching:', error);
        searchResults.innerHTML = '<p style="padding: 10px; text-align: center;">Error searching. Please try again.</p>';
        searchResults.classList.add('active');
    }
}

function renderSearchResults(results) {
    searchResults.innerHTML = '';

    results.forEach(result => {
        if (!result) return; // Skip undefined results

        // Check if it's a movie, TV show, or person
        const isPerson = result.known_for_department || currentSearchType === 'person';

        // Get details based on type
        const title = isPerson ? result.name : (result.title || result.name);
        const year = getYear(isPerson
            ? (result.known_for && result.known_for[0] ? result.known_for[0].release_date || result.known_for[0].first_air_date : '')
            : result.release_date || result.first_air_date);
        const posterPath = isPerson ? result.profile_path : result.poster_path;
        const mediaType = isPerson ? 'Person' : (result.media_type === 'tv' ? 'TV Show' : 'Movie');

        const posterUrl = posterPath
            ? `${IMAGE_BASE_URL}${posterPath}`
            : 'https://via.placeholder.com/40x60/333/666?text=No+Image';

        const resultElement = document.createElement('div');
        resultElement.className = 'search-result';
        resultElement.innerHTML = `
            <img src="${posterUrl}" alt="${title}" class="result-poster" onerror="this.src='https://via.placeholder.com/40x60/333/666?text=No+Image'">
            <div class="result-info">
                <div class="result-title">${title}</div>
                <div class="result-meta">${year ? `${year} • ` : ''}${mediaType}</div>
            </div>
        `;

        resultElement.addEventListener('click', () => {
            addToTable(result, isPerson);
            searchResults.classList.remove('active');
            searchInput.value = '';
        });

        searchResults.appendChild(resultElement);
    });
}

// Helper function to extract year from date
function getYear(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return !isNaN(date.getFullYear()) ? date.getFullYear() : '';
}

// Add selected item to the table
async function addToTable(item, isPerson) {
    try {
        // For persons, fetch their popular movies/shows
        if (isPerson) {
            const response = await fetch(`${BASE_URL}/person/${item.id}/combined_credits?api_key=${API_KEY}`);

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const data = await response.json();

            // Get top 3 popular movies/shows
            if (data && data.cast && data.cast.length > 0) {
                const topCredits = data.cast
                    .sort((a, b) => b.popularity - a.popularity)
                    .slice(0, 3);

                // Add each to the first tier
                const firstTierContent = document.querySelector('.tier-content[data-tier="masterpiece"]');

                for (const credit of topCredits) {
                    // Skip if it's a person
                    if (credit.known_for_department) continue;

                    const cardElement = createMovieCard(credit);

                    // Remove empty state if present
                    const emptyState = firstTierContent.querySelector('.empty-state');
                    if (emptyState) {
                        firstTierContent.removeChild(emptyState);
                    }

                    firstTierContent.appendChild(cardElement);
                }

                showToast(`Added ${topCredits.length} titles from ${item.name}`);
            } else {
                showToast('No movies or shows found for this actor');
            }
        } else {
            // For movies/shows, add directly to first tier
            const firstTierContent = document.querySelector('.tier-content[data-tier="masterpiece"]');
            const cardElement = createMovieCard(item);

            // Remove empty state if present
            const emptyState = firstTierContent.querySelector('.empty-state');
            if (emptyState) {
                firstTierContent.removeChild(emptyState);
            }

            firstTierContent.appendChild(cardElement);
            showToast(`Added "${item.title || item.name}" to S Tier`);
        }

        // Save to localStorage
        saveToLocalStorage();
    } catch (error) {
        console.error('Error adding item:', error);
        showToast('Error adding item. Please try again.');
    }
}

// Create a movie card element
function createMovieCard(item) {
    // Skip if it's a person
    if (item.known_for_department) return null;

    const title = item.title || item.name;
    const year = getYear(item.release_date || item.first_air_date);
    const mediaType = item.media_type || (item.first_air_date ? 'tv' : 'movie');

    const cardElement = document.createElement('div');
    cardElement.className = 'movie-card';
    cardElement.draggable = true;
    cardElement.dataset.id = item.id;
    cardElement.dataset.title = title;
    cardElement.dataset.year = year || '';
    cardElement.dataset.type = mediaType;

    if (isEditMode) {
        cardElement.classList.add('edit-mode');
    }

    cardElement.innerHTML = `
        <div class="card-title">${title}</div>
        <div class="card-year">${year || ''}</div>
    `;

    // Card click handler for edit mode
    cardElement.addEventListener('click', function(e) {
        if (isEditMode) {
            const container = this.parentNode;
            container.removeChild(this);

            // Add empty state if no cards left
            if (container.children.length === 0) {
                showEmptyState(container);
            }

            saveToLocalStorage();
            showToast(`Removed "${title}"`);
            e.stopPropagation();
        }
    });

    // Setup drag functionality
    setupDragForElement(cardElement);

    return cardElement;
}

// Show empty state in a container
function showEmptyState(container) {
    // Clear existing content
    container.innerHTML = '';

    // Create empty state element
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    emptyState.textContent = 'Drag items here';
    container.appendChild(emptyState);
}

// Drag and Drop functionality
function setupDragAndDrop() {
    // Setup drag events for tier-content containers
    tierContents.forEach(container => {
        container.addEventListener('dragover', dragOver);
        container.addEventListener('dragenter', dragEnter);
        container.addEventListener('dragleave', dragLeave);
        container.addEventListener('drop', drop);
    });
}

function setupDragForElement(element) {
    element.addEventListener('dragstart', dragStart);
    element.addEventListener('dragend', dragEnd);
}

function dragStart(e) {
    // Prevent dragging in edit mode
    if (isEditMode) {
        e.preventDefault();
        return;
    }

    e.dataTransfer.setData('text/plain', e.target.dataset.id);

    // Add dragging class after a small delay (for visual feedback)
    setTimeout(() => {
        e.target.style.opacity = '0.5';
    }, 0);
}

function dragEnd(e) {
    e.target.style.opacity = '1';
    document.querySelectorAll('.tier-content').forEach(container => {
        container.classList.remove('highlight');
    });
}

function dragOver(e) {
    // Prevent default to allow drop
    e.preventDefault();
}

function dragEnter(e) {
    e.preventDefault();
    if (!isEditMode) {
        this.classList.add('highlight');
    }
}

function dragLeave(e) {
    this.classList.remove('highlight');
}

function drop(e) {
    e.preventDefault();
    this.classList.remove('highlight');

    // If in edit mode, don't allow drops
    if (isEditMode) return;

    const id = e.dataTransfer.getData('text/plain');
    const draggedElement = document.querySelector(`.movie-card[data-id="${id}"]`);

    if (!draggedElement) return;

    // Remove empty state if present
    const emptyState = this.querySelector('.empty-state');
    if (emptyState) {
        this.removeChild(emptyState);
    }

    // Move the card to the new container
    this.appendChild(draggedElement);

    // Save to localStorage
    saveToLocalStorage();

    // Show toast with the tier name
    const tierName = getTierName(this.dataset.tier);
    showToast(`Moved "${draggedElement.dataset.title}" to ${tierName}`);
}

// Get readable tier name
function getTierName(tier) {
    switch(tier) {
        case 'masterpiece': return 'S Tier';
        case 'great': return 'A Tier';
        case 'good': return 'B Tier';
        case 'decent': return 'C Tier';
        case 'mediocre': return 'D Tier';
        case 'bad': return 'F Tier';
        default: return tier;
    }
}

// LocalStorage functions
function saveToLocalStorage() {
    const data = { tiers: {} };

    // Save tier data
    tierContents.forEach(container => {
        const tier = container.dataset.tier;
        data.tiers[tier] = [];

        const cards = container.querySelectorAll('.movie-card');
        cards.forEach(card => {
            data.tiers[tier].push({
                id: card.dataset.id,
                title: card.dataset.title,
                year: card.dataset.year,
                type: card.dataset.type
            });
        });
    });

    localStorage.setItem('mediaRankerData', JSON.stringify(data));
}

function loadFromLocalStorage() {
    const savedData = localStorage.getItem('mediaRankerData');
    if (!savedData) return;

    try {
        const data = JSON.parse(savedData);
        let hasData = false;

        // Load tier data
        Object.keys(data.tiers).forEach(tier => {
            const container = document.querySelector(`.tier-content[data-tier="${tier}"]`);
            if (!container) return;

            if (data.tiers[tier].length > 0) {
                hasData = true;
                container.innerHTML = ''; // Clear any empty state

                data.tiers[tier].forEach(item => {
                    const cardElement = createCardFromData(item);
                    container.appendChild(cardElement);
                });
            }
        });

        if (!hasData) {
            localStorage.removeItem('mediaRankerData');
        }
    } catch (error) {
        console.error('Error loading data from localStorage:', error);
    }
}

function createCardFromData(item) {
    const cardElement = document.createElement('div');
    cardElement.className = 'movie-card';
    cardElement.draggable = true;
    cardElement.dataset.id = item.id;
    cardElement.dataset.title = item.title;
    cardElement.dataset.year = item.year || '';
    cardElement.dataset.type = item.type || 'movie';

    if (isEditMode) {
        cardElement.classList.add('edit-mode');
    }

    cardElement.innerHTML = `
        <div class="card-title">${item.title}</div>
        <div class="card-year">${item.year || ''}</div>
    `;

    // Card click handler for edit mode
    cardElement.addEventListener('click', function(e) {
        if (isEditMode) {
            const container = this.parentNode;
            container.removeChild(this);

            // Add empty state if no cards left
            if (container.children.length === 0) {
                showEmptyState(container);
            }

            saveToLocalStorage();
            showToast(`Removed "${item.title}"`);
            e.stopPropagation();
        }
    });

    // Setup drag functionality
    setupDragForElement(cardElement);

    return cardElement;
}

// Export/Import functionality
function exportTable() {
    const data = {
        tiers: {},
        version: '1.0',
        exportedAt: new Date().toISOString()
    };

    // Get tier data
    tierContents.forEach(container => {
        const tier = container.dataset.tier;
        data.tiers[tier] = [];

        const cards = container.querySelectorAll('.movie-card');
        cards.forEach(card => {
            data.tiers[tier].push({
                id: card.dataset.id,
                title: card.dataset.title,
                year: card.dataset.year,
                type: card.dataset.type
            });
        });
    });

    // Download JSON file
    downloadJSON(data, 'media-ranker-export.json');
    showToast('Ranking exported successfully!');
}

function downloadJSON(data, filename) {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 0);
}

function importData(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            const data = JSON.parse(event.target.result);

            // Validate data structure
            if (data.tiers) {
                importTableData(data);
            } else {
                showToast('Invalid file format');
            }
        } catch (error) {
            console.error('Error importing data:', error);
            showToast('Error importing data. Invalid format.');
        }
    };

    reader.readAsText(file);
    e.target.value = ''; // Reset file input
}

function importTableData(data) {
    // Clear existing table data
    clearAllData(false);

    // Import tier data
    Object.keys(data.tiers).forEach(tier => {
        const container = document.querySelector(`.tier-content[data-tier="${tier}"]`);
        if (!container) return;

        if (data.tiers[tier].length > 0) {
            container.innerHTML = ''; // Clear any empty state

            data.tiers[tier].forEach(item => {
                const cardElement = createCardFromData(item);
                container.appendChild(cardElement);
            });
        }
    });

    saveToLocalStorage();
    showToast('Ranking imported successfully!');
}

function clearAllData(showToastMsg = true) {
    // Clear all tier containers
    tierContents.forEach(container => {
        showEmptyState(container);
    });

    // Clear localStorage
    localStorage.removeItem('mediaRankerData');

    if (showToastMsg) {
        showToast('All data cleared');
    }
}

// Toast notification
function showToast(message) {
    const toastIcon = toast.querySelector('i');
    const toastText = toast.querySelector('span');

    // Set appropriate icon based on message
    if (message.includes('success') || message.includes('added') || message.includes('moved')) {
        toastIcon.className = 'fas fa-check-circle';
    } else if (message.includes('Error') || message.includes('Invalid')) {
        toastIcon.className = 'fas fa-exclamation-circle';
    } else if (message.includes('removed') || message.includes('cleared')) {
        toastIcon.className = 'fas fa-trash-alt';
    } else {
        toastIcon.className = 'fas fa-info-circle';
    }

    toastText.textContent = message;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Utility functions
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}
