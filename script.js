/**
 * Media Ranker Application
 * Enhanced JavaScript for smoother user experience
 */

// API Configuration
const TMDB = {
    apiKey: 'd64f0ecf30a298852d82fac294b62f45',
    baseUrl: 'https://api.themoviedb.org/3',
    imageBaseUrl: 'https://image.tmdb.org/t/p/w500',
    placeholderImage: 'https://via.placeholder.com/120x180/333/666?text=No+Image',

    // Helper methods for API requests
    async searchMedia(query, type = 'movie') {
        const endpoint = type === 'movie' ? '/search/multi' : '/search/person';
        const url = `${this.baseUrl}${endpoint}?api_key=${this.apiKey}&query=${encodeURIComponent(query)}&include_adult=false`;

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`API Error: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error('TMDB API Error:', error);
            return { results: [] };
        }
    },

    async getPersonCredits(personId) {
        const url = `${this.baseUrl}/person/${personId}/combined_credits?api_key=${this.apiKey}`;

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`API Error: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error('TMDB API Error:', error);
            return { cast: [] };
        }
    },

    getImageUrl(path) {
        return path ? `${this.imageBaseUrl}${path}` : this.placeholderImage;
    },

    // Parse movie/show data into a standardized format
    parseMediaItem(item) {
        if (!item) return null;

        const isPerson = item.known_for_department || item.media_type === 'person';
        if (isPerson) return null;

        const title = item.title || item.name || 'Unknown Title';
        const year = this.getYear(item.release_date || item.first_air_date);
        const posterPath = item.poster_path;
        const mediaType = item.media_type || (item.first_air_date ? 'tv' : 'movie');

        return {
            id: item.id,
            title,
            year,
            poster: posterPath,
            type: mediaType
        };
    },

    getYear(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return !isNaN(date.getFullYear()) ? date.getFullYear() : '';
    }
};

// UI Manager
const UIManager = {
    elements: {
        searchInput: document.querySelector('.search-input'),
        searchResults: document.querySelector('.search-results'),
        typeButtons: document.querySelectorAll('.type-btn'),
        tierContents: document.querySelectorAll('.tier-content'),
        pendingItems: document.querySelector('.pending-items'),
        exportTableBtn: document.getElementById('export-table'),
        importDataBtn: document.getElementById('import-data'),
        clearAllBtn: document.getElementById('clear-all'),
        fileInput: document.getElementById('file-input'),
        toast: document.getElementById('toast'),
        themeToggle: document.getElementById('theme-toggle'),
        editModeBtn: document.getElementById('edit-mode-btn')
    },

    state: {
        currentSearchType: 'movie',
        isEditMode: false,
        draggedElement: null
    },

    init() {
        this.setupEventListeners();
        this.initializeEmptyStates();
        this.loadFromLocalStorage();
        this.loadThemePreference();
    },

    setupEventListeners() {
        // Theme toggle
        this.elements.themeToggle.addEventListener('click', () => this.toggleTheme());

        // Search functionality
        this.elements.searchInput.addEventListener('input', debounce(() => this.handleSearch(), 300));

        // Search type buttons
        this.elements.typeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                this.elements.typeButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.state.currentSearchType = btn.dataset.type;
                this.elements.searchInput.placeholder = this.state.currentSearchType === 'movie'
                    ? 'Search for movies or TV shows...'
                    : 'Search for actors...';
                this.elements.searchInput.value = '';
                this.elements.searchResults.classList.remove('active');
            });
        });

        // Edit mode toggle
        this.elements.editModeBtn.addEventListener('click', () => this.toggleEditMode());

        // Export/Import functionality
        this.elements.exportTableBtn.addEventListener('click', () => this.exportTable());
        this.elements.importDataBtn.addEventListener('click', () => this.elements.fileInput.click());
        this.elements.fileInput.addEventListener('change', (e) => this.importData(e));
        this.elements.clearAllBtn.addEventListener('click', () => this.clearAllData());

        // Close search results when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.elements.searchInput.contains(e.target) && !this.elements.searchResults.contains(e.target)) {
                this.elements.searchResults.classList.remove('active');
            }
        });

        // Set up drag and drop
        this.setupDragAndDrop();
    },

    initializeEmptyStates() {
        // Initialize tier content containers
        this.elements.tierContents.forEach(container => {
            this.showEmptyState(container);
        });

        // Initialize pending items container
        this.showEmptyState(this.elements.pendingItems, 'Search for movies or shows to add them here');
    },

    // Theme functions
    toggleTheme() {
        document.body.classList.toggle('light-theme');

        const isLight = document.body.classList.contains('light-theme');
        localStorage.setItem('themePreference', isLight ? 'light' : 'dark');
        this.updateThemeToggle(isLight ? 'light' : 'dark');
    },

    loadThemePreference() {
        const savedTheme = localStorage.getItem('themePreference');
        if (savedTheme === 'light') {
            document.body.classList.add('light-theme');
            this.updateThemeToggle('light');
        } else {
            this.updateThemeToggle('dark');
        }
    },

    updateThemeToggle(theme) {
        const icon = this.elements.themeToggle.querySelector('i');
        const text = this.elements.themeToggle.querySelector('span');

        if (theme === 'light') {
            icon.className = 'fas fa-sun';
            text.textContent = 'Light';
        } else {
            icon.className = 'fas fa-moon';
            text.textContent = 'Dark';
        }
    },

    // Edit mode toggle
    toggleEditMode() {
        this.state.isEditMode = !this.state.isEditMode;

        const allCards = document.querySelectorAll('.movie-card');

        if (this.state.isEditMode) {
            this.elements.editModeBtn.classList.add('active');
            this.elements.editModeBtn.querySelector('span').textContent = 'Edit Mode: On';
            allCards.forEach(card => card.classList.add('edit-mode'));
            this.showToast('Edit mode activated - Click cards to remove them');
        } else {
            this.elements.editModeBtn.classList.remove('active');
            this.elements.editModeBtn.querySelector('span').textContent = 'Edit Mode: Off';
            allCards.forEach(card => card.classList.remove('edit-mode'));
        }
    },

    // Search functionality
    async handleSearch() {
        const query = this.elements.searchInput.value.trim();

        if (query.length < 2) {
            this.elements.searchResults.classList.remove('active');
            this.elements.searchResults.innerHTML = '';
            return;
        }

        try {
            // Show loading indicator
            this.elements.searchResults.innerHTML = '<p style="padding: 10px; text-align: center;">Searching...</p>';
            this.elements.searchResults.classList.add('active');

            const data = await TMDB.searchMedia(query, this.state.currentSearchType);

            // Process results
            let results = [];
            if (data && data.results) {
                // Filter results for movie search type
                results = this.state.currentSearchType === 'movie'
                    ? data.results.filter(item => item && (item.media_type === 'movie' || item.media_type === 'tv'))
                    : data.results;

                // Limit to 5 results
                results = results.slice(0, 5);
            }

            if (results.length === 0) {
                this.elements.searchResults.innerHTML = '<p style="padding: 10px; text-align: center;">No results found</p>';
            } else {
                this.renderSearchResults(results);
            }
        } catch (error) {
            console.error('Error searching:', error);
            this.elements.searchResults.innerHTML = '<p style="padding: 10px; text-align: center;">Error searching. Please try again.</p>';
        }
    },

    renderSearchResults(results) {
        this.elements.searchResults.innerHTML = '';

        results.forEach(result => {
            if (!result) return; // Skip undefined results

            // Check if it's a movie, TV show, or person
            const isPerson = result.known_for_department || this.state.currentSearchType === 'person';

            // Get details based on type
            const title = isPerson ? result.name : (result.title || result.name);
            const year = TMDB.getYear(isPerson
                ? (result.known_for && result.known_for[0] ? result.known_for[0].release_date || result.known_for[0].first_air_date : '')
                : result.release_date || result.first_air_date);
            const posterPath = isPerson ? result.profile_path : result.poster_path;
            const mediaType = isPerson ? 'Person' : (result.media_type === 'tv' ? 'TV Show' : 'Movie');

            const posterUrl = TMDB.getImageUrl(posterPath);

            const resultElement = document.createElement('div');
            resultElement.className = 'search-result';
            resultElement.innerHTML = `
                <img src="${posterUrl}" alt="${title}" class="result-poster" onerror="this.src='${TMDB.placeholderImage}'">
                <div class="result-info">
                    <div class="result-title">${title}</div>
                    <div class="result-meta">${year ? `${year} • ` : ''}${mediaType}</div>
                </div>
            `;

            resultElement.addEventListener('click', () => {
                this.addToPendingItems(result, isPerson);
                this.elements.searchResults.classList.remove('active');
                this.elements.searchInput.value = '';
                this.elements.searchInput.focus(); // Re-focus input for continuous searching
            });

            this.elements.searchResults.appendChild(resultElement);
        });
    },

    // Add selected item to pending items
    async addToPendingItems(item, isPerson) {
        try {
            // Remove empty state if present
            const emptyState = this.elements.pendingItems.querySelector('.empty-state');
            if (emptyState) {
                this.elements.pendingItems.removeChild(emptyState);
            }

            let addedCount = 0;

            // For persons, fetch their popular movies/shows
            if (isPerson) {
                // Show loading toast
                this.showToast(`Finding movies with ${item.name}...`);

                const data = await TMDB.getPersonCredits(item.id);

                // Get top 3 popular movies/shows
                if (data && data.cast && data.cast.length > 0) {
                    const topCredits = data.cast
                        .sort((a, b) => b.popularity - a.popularity)
                        .slice(0, 3);

                    // Add each to pending items
                    for (const credit of topCredits) {
                        const mediaItem = TMDB.parseMediaItem(credit);
                        if (mediaItem && mediaItem.poster) {
                            const cardElement = this.createMovieCard(mediaItem);
                            if (cardElement) {
                                this.elements.pendingItems.appendChild(cardElement);
                                addedCount++;
                            }
                        }
                    }

                    this.showToast(`Added ${addedCount} titles from ${item.name}`);
                } else {
                    this.showToast('No movies or shows found for this actor');
                }
            } else {
                // For movies/shows, add directly
                const mediaItem = TMDB.parseMediaItem(item);
                if (mediaItem && mediaItem.poster) {
                    const cardElement = this.createMovieCard(mediaItem);
                    if (cardElement) {
                        this.elements.pendingItems.appendChild(cardElement);
                        this.showToast(`Added "${mediaItem.title}" to your selection`);
                        addedCount = 1;
                    }
                } else {
                    this.showToast('Unable to add item (missing poster)');
                }
            }

            // Add back empty state if no items were added
            if (addedCount === 0 && this.elements.pendingItems.children.length === 0) {
                this.showEmptyState(this.elements.pendingItems, 'Search for movies or shows to add them here');
            }

            // Save to localStorage
            this.saveToLocalStorage();
        } catch (error) {
            console.error('Error adding item:', error);
            this.showToast('Error adding item. Please try again.');

            // Add back empty state if no items were added
            if (this.elements.pendingItems.children.length === 0) {
                this.showEmptyState(this.elements.pendingItems, 'Search for movies or shows to add them here');
            }
        }
    },

    // Create a movie card element
    createMovieCard(item) {
        if (!item || !item.poster) return null;

        const posterUrl = TMDB.getImageUrl(item.poster);

        const cardElement = document.createElement('div');
        cardElement.className = 'movie-card';
        cardElement.draggable = true;
        cardElement.dataset.id = item.id;
        cardElement.dataset.title = item.title;
        cardElement.dataset.year = item.year || '';
        cardElement.dataset.poster = item.poster;
        cardElement.dataset.type = item.type;

        if (this.state.isEditMode) {
            cardElement.classList.add('edit-mode');
        }

        cardElement.innerHTML = `
            <img src="${posterUrl}" alt="${item.title}" class="card-poster" onerror="this.src='${TMDB.placeholderImage}'">
            <div class="card-info">
                <div class="card-title">${item.title}</div>
                <div class="card-year">${item.year || ''}</div>
            </div>
        `;

        // Card click handler for edit mode
        cardElement.addEventListener('click', (e) => {
            if (this.state.isEditMode) {
                const container = cardElement.parentNode;
                container.removeChild(cardElement);

                // Add empty state if no cards left
                if (container.children.length === 0) {
                    if (container === this.elements.pendingItems) {
                        this.showEmptyState(container, 'Search for movies or shows to add them here');
                    } else {
                        this.showEmptyState(container);
                    }
                }

                this.saveToLocalStorage();
                this.showToast(`Removed "${item.title}"`);
                e.stopPropagation();
            }
        });

        // Setup drag functionality
        this.setupDragForElement(cardElement);

        return cardElement;
    },

    // Show empty state in a container
    showEmptyState(container, message = 'Drag items here') {
        // Clear existing content
        container.innerHTML = '';

        // Create empty state element
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        emptyState.textContent = message;
        container.appendChild(emptyState);
    },

    // Drag and Drop functionality
    setupDragAndDrop() {
        // Setup drag events for tier-content containers
        this.elements.tierContents.forEach(container => {
            container.addEventListener('dragover', e => this.dragOver(e));
            container.addEventListener('dragenter', e => this.dragEnter(e, container));
            container.addEventListener('dragleave', e => this.dragLeave(e, container));
            container.addEventListener('drop', e => this.drop(e, container));
        });

        // Make sure pending items container can also receive dropped items
        this.elements.pendingItems.addEventListener('dragover', e => this.dragOver(e));
        this.elements.pendingItems.addEventListener('dragenter', e => this.dragEnter(e, this.elements.pendingItems));
        this.elements.pendingItems.addEventListener('dragleave', e => this.dragLeave(e, this.elements.pendingItems));
        this.elements.pendingItems.addEventListener('drop', e => this.drop(e, this.elements.pendingItems));
    },

    setupDragForElement(element) {
        element.addEventListener('dragstart', e => this.dragStart(e, element));
        element.addEventListener('dragend', e => this.dragEnd(e, element));
    },

    dragStart(e, element) {
        // Prevent dragging in edit mode
        if (this.state.isEditMode) {
            e.preventDefault();
            return;
        }

        e.dataTransfer.setData('text/plain', element.dataset.id);
        this.state.draggedElement = element;

        // Add visual feedback with a small delay (helps show what's being dragged)
        setTimeout(() => {
            element.style.opacity = '0.4';
        }, 0);
    },

    dragEnd(e, element) {
        element.style.opacity = '1';
        this.state.draggedElement = null;

        // Remove highlight from all containers
        document.querySelectorAll('.tier-content, .pending-items').forEach(container => {
            container.classList.remove('highlight');
        });
    },

    dragOver(e) {
        // Prevent default to allow drop
        e.preventDefault();
    },

    dragEnter(e, container) {
        e.preventDefault();
        if (!this.state.isEditMode && this.state.draggedElement) {
            container.classList.add('highlight');
        }
    },

    dragLeave(e, container) {
        container.classList.remove('highlight');
    },

    drop(e, container) {
        e.preventDefault();
        container.classList.remove('highlight');

        // If in edit mode, don't allow drops
        if (this.state.isEditMode) return;

        const id = e.dataTransfer.getData('text/plain');
        const draggedElement = document.querySelector(`.movie-card[data-id="${id}"]`);

        if (!draggedElement) return;

        // Remove empty state if present
        const emptyState = container.querySelector('.empty-state');
        if (emptyState) {
            container.removeChild(emptyState);
        }

        // Add nice animation effect when dropping
        draggedElement.style.transition = 'transform 0.2s ease-in-out';
        draggedElement.style.transform = 'scale(1.05)';

        // Move the card to the new container
        container.appendChild(draggedElement);

        // Reset the transform after the animation
        setTimeout(() => {
            draggedElement.style.transform = 'scale(1)';
        }, 200);

        // Save to localStorage
        this.saveToLocalStorage();

        // Show toast with appropriate message
        if (container.classList.contains('tier-content')) {
            const tierName = this.getTierName(container.dataset.tier);
            this.showToast(`Moved "${draggedElement.dataset.title}" to ${tierName}`);
        } else {
            this.showToast(`Moved "${draggedElement.dataset.title}" to your selection`);
        }
    },

    // Get readable tier name
    getTierName(tier) {
        switch(tier) {
            case 'masterpiece': return 'S Tier';
            case 'great': return 'A Tier';
            case 'good': return 'B Tier';
            case 'decent': return 'C Tier';
            case 'mediocre': return 'D Tier';
            case 'bad': return 'F Tier';
            default: return tier;
        }
    },

    // LocalStorage functions
    saveToLocalStorage() {
        const data = {
            tiers: {},
            pendingItems: []
        };

        // Save tier data
        this.elements.tierContents.forEach(container => {
            const tier = container.dataset.tier;
            data.tiers[tier] = [];

            const cards = container.querySelectorAll('.movie-card');
            cards.forEach(card => {
                data.tiers[tier].push({
                    id: card.dataset.id,
                    title: card.dataset.title,
                    year: card.dataset.year,
                    poster: card.dataset.poster,
                    type: card.dataset.type
                });
            });
        });

        // Save pending items
        const pendingCards = this.elements.pendingItems.querySelectorAll('.movie-card');
        pendingCards.forEach(card => {
            data.pendingItems.push({
                id: card.dataset.id,
                title: card.dataset.title,
                year: card.dataset.year,
                poster: card.dataset.poster,
                type: card.dataset.type
            });
        });

        localStorage.setItem('mediaRankerData', JSON.stringify(data));
    },

    loadFromLocalStorage() {
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
                        const cardElement = this.createCardFromData(item);
                        if (cardElement) container.appendChild(cardElement);
                    });
                }
            });

            // Load pending items
            if (data.pendingItems && data.pendingItems.length > 0) {
                this.elements.pendingItems.innerHTML = ''; // Clear any empty state
                hasData = true;

                data.pendingItems.forEach(item => {
                    const cardElement = this.createCardFromData(item);
                    if (cardElement) this.elements.pendingItems.appendChild(cardElement);
                });
            }

            if (!hasData) {
                localStorage.removeItem('mediaRankerData');
            }
        } catch (error) {
            console.error('Error loading data from localStorage:', error);
        }
    },

    createCardFromData(item) {
        if (!item.poster) return null; // Skip if no poster

        const posterUrl = TMDB.getImageUrl(item.poster);

        const cardElement = document.createElement('div');
        cardElement.className = 'movie-card';
        cardElement.draggable = true;
        cardElement.dataset.id = item.id;
        cardElement.dataset.title = item.title;
        cardElement.dataset.year = item.year || '';
        cardElement.dataset.poster = item.poster;
        cardElement.dataset.type = item.type || 'movie';

        if (this.state.isEditMode) {
            cardElement.classList.add('edit-mode');
        }

        cardElement.innerHTML = `
            <img src="${posterUrl}" alt="${item.title}" class="card-poster" onerror="this.src='${TMDB.placeholderImage}'">
            <div class="card-info">
                <div class="card-title">${item.title}</div>
                <div class="card-year">${item.year || ''}</div>
            </div>
        `;

        // Card click handler for edit mode
        cardElement.addEventListener('click', (e) => {
            if (this.state.isEditMode) {
                const container = cardElement.parentNode;
                container.removeChild(cardElement);

                // Add empty state if no cards left
                if (container.children.length === 0) {
                    if (container === this.elements.pendingItems) {
                        this.showEmptyState(container, 'Search for movies or shows to add them here');
                    } else {
                        this.showEmptyState(container);
                    }
                }

                this.saveToLocalStorage();
                this.showToast(`Removed "${item.title}"`);
                e.stopPropagation();
            }
        });

        // Setup drag functionality
        this.setupDragForElement(cardElement);

        return cardElement;
    },

    // Export/Import functionality
    exportTable() {
        const data = {
            tiers: {},
            pendingItems: [],
            version: '1.0',
            exportedAt: new Date().toISOString()
        };

        // Get tier data
        this.elements.tierContents.forEach(container => {
            const tier = container.dataset.tier;
            data.tiers[tier] = [];

            const cards = container.querySelectorAll('.movie-card');
            cards.forEach(card => {
                data.tiers[tier].push({
                    id: card.dataset.id,
                    title: card.dataset.title,
                    year: card.dataset.year,
                    poster: card.dataset.poster,
                    type: card.dataset.type
                });
            });
        });

        // Get pending items
        const pendingCards = this.elements.pendingItems.querySelectorAll('.movie-card');
        pendingCards.forEach(card => {
            data.pendingItems.push({
                id: card.dataset.id,
                title: card.dataset.title,
                year: card.dataset.year,
                poster: card.dataset.poster,
                type: card.dataset.type
            });
        });

        // Download JSON file
        this.downloadJSON(data, 'media-ranker-export.json');
        this.showToast('Ranking exported successfully!');
    },

    downloadJSON(data, filename) {
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
    },

    importData(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);

                // Validate data structure
                if (data.tiers) {
                    this.importTableData(data);
                } else {
                    this.showToast('Invalid file format');
                }
            } catch (error) {
                console.error('Error importing data:', error);
                this.showToast('Error importing data. Invalid format.');
            }
        };

        reader.readAsText(file);
        e.target.value = ''; // Reset file input
    },

    importTableData(data) {
        // Show loading toast
        this.showToast('Importing data...');

        // Clear existing data
        this.clearAllData(false);

        // Import tier data
        Object.keys(data.tiers).forEach(tier => {
            const container = document.querySelector(`.tier-content[data-tier="${tier}"]`);
            if (!container) return;

            if (data.tiers[tier].length > 0) {
                container.innerHTML = ''; // Clear any empty state

                data.tiers[tier].forEach(item => {
                    const cardElement = this.createCardFromData(item);
                    if (cardElement) container.appendChild(cardElement);
                });
            }
        });

        // Import pending items
        if (data.pendingItems && data.pendingItems.length > 0) {
            this.elements.pendingItems.innerHTML = ''; // Clear any empty state

            data.pendingItems.forEach(item => {
                const cardElement = this.createCardFromData(item);
                if (cardElement) this.elements.pendingItems.appendChild(cardElement);
            });
        }

        this.saveToLocalStorage();
        this.showToast('Ranking imported successfully!');
    },

    clearAllData(showToastMsg = true) {
        // Clear all tier containers
        this.elements.tierContents.forEach(container => {
            this.showEmptyState(container);
        });

        // Clear pending items
        this.showEmptyState(this.elements.pendingItems, 'Search for movies or shows to add them here');

        // Clear localStorage
        localStorage.removeItem('mediaRankerData');

        if (showToastMsg) {
            this.showToast('All data cleared');
        }
    },

    // Toast notification with queue management
    toastQueue: [],
    toastDisplaying: false,

    showToast(message) {
        // Add to queue
        this.toastQueue.push(message);

        // If not already displaying, start displaying
        if (!this.toastDisplaying) {
            this.processToastQueue();
        }
    },

    processToastQueue() {
        if (this.toastQueue.length === 0) {
            this.toastDisplaying = false;
            return;
        }

        this.toastDisplaying = true;
        const message = this.toastQueue.shift();

        const toastIcon = this.elements.toast.querySelector('i');
        const toastText = this.elements.toast.querySelector('span');

        // Set appropriate icon based on message
        if (message.includes('success') || message.includes('added') || message.includes('moved')) {
            toastIcon.className = 'fas fa-check-circle';
        } else if (message.includes('Error') || message.includes('Invalid')) {
            toastIcon.className = 'fas fa-exclamation-circle';
        } else if (message.includes('removed') || message.includes('cleared')) {
            toastIcon.className = 'fas fa-trash-alt';
        } else if (message.includes('Finding')) {
            toastIcon.className = 'fas fa-spinner fa-spin';
        } else {
            toastIcon.className = 'fas fa-info-circle';
        }

        toastText.textContent = message;
        this.elements.toast.classList.add('show');

        setTimeout(() => {
            this.elements.toast.classList.remove('show');

            // Wait for fade out transition before processing next toast
            setTimeout(() => {
                this.processToastQueue();
            }, 300);
        }, 2000);
    }
};

// Utility functions
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    UIManager.init();
});
