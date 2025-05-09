/**
 * Rank-it - Media Ranking Application
 * Enhanced JavaScript for better user experience
 */

// API Configuration
const TMDB = {
    apiKey: 'd64f0ecf30a298852d82fac294b62f45',
    baseUrl: 'https://api.themoviedb.org/3',
    imageBaseUrl: 'https://image.tmdb.org/t/p/w500',
    placeholderImage: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="120" height="180" viewBox="0 0 120 180"%3E%3Crect width="120" height="180" fill="%23333"%3E%3C/rect%3E%3Ctext x="50%25" y="50%25" fill="%23666" font-family="Arial" font-size="12" text-anchor="middle" dominant-baseline="middle"%3ENo Image%3C/text%3E%3C/svg%3E',

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

        const isPerson = item.media_type === 'person';
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
        shareBtn: document.getElementById('share-btn'),
        fileInput: document.getElementById('file-input'),
        toast: document.getElementById('toast'),
        themeToggle: document.getElementById('theme-toggle'),
        editModeBtn: document.getElementById('edit-mode-btn'),
        confirmDialog: null,        // Will be created dynamically
        shareModal: null            // Will be created dynamically
    },

    state: {
        currentSearchType: 'movie',
        isEditMode: false,
        draggedElement: null
    },

    init() {
        this.createModals();
        this.setupEventListeners();
        this.initializeEmptyStates();
        this.loadFromLocalStorage();
        this.loadThemePreference();
    },

    createModals() {
        // Create confirmation dialog
        const confirmDialog = document.createElement('div');
        confirmDialog.className = 'modal confirm-dialog';
        confirmDialog.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Confirm Action</h2>
                    <button class="close-modal"><i class="fas fa-times"></i></button>
                </div>
                <div class="modal-body">
                    <p class="confirm-message"></p>
                </div>
                <div class="modal-footer">
                    <button class="cancel-btn">Cancel</button>
                    <button class="confirm-btn danger-btn">Confirm</button>
                </div>
            </div>
        `;
        document.body.appendChild(confirmDialog);
        this.elements.confirmDialog = confirmDialog;

        // Create share modal
        const shareModal = document.createElement('div');
        shareModal.className = 'modal share-modal';
        shareModal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Share Your Rankings</h2>
                    <button class="close-modal"><i class="fas fa-times"></i></button>
                </div>
                <div class="modal-body">
                    <div class="share-instructions">
                        <p>Your rankings are ready to be shared! Take a screenshot of the preview below.</p>
                    </div>
                    <div class="share-preview-container">
                        <div id="share-preview" class="share-preview">
                            <div class="share-header">
                                <div class="share-logo">
                                    <i class="fas fa-ranking-star"></i>
                                    <h2>Rank-it</h2>
                                </div>
                                <div class="share-title">My Rankings</div>
                            </div>
                            <div class="share-tier-table"></div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="cancel-btn">Close</button>
                    <button id="download-image-btn" class="primary-btn">
                        <i class="fas fa-download"></i> Save as Image
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(shareModal);
        this.elements.shareModal = shareModal;

        // Setup modal event listeners
        this.setupModalListeners();
    },

    setupModalListeners() {
        // Confirm dialog
        const confirmDialog = this.elements.confirmDialog;
        confirmDialog.querySelector('.close-modal').addEventListener('click', () => {
            confirmDialog.classList.remove('active');
        });
        confirmDialog.querySelector('.cancel-btn').addEventListener('click', () => {
            confirmDialog.classList.remove('active');
        });

        // Share modal
        const shareModal = this.elements.shareModal;
        shareModal.querySelector('.close-modal').addEventListener('click', () => {
            shareModal.classList.remove('active');
        });
        shareModal.querySelector('.cancel-btn').addEventListener('click', () => {
            shareModal.classList.remove('active');
        });
        shareModal.querySelector('#download-image-btn').addEventListener('click', () => {
            this.downloadShareImage();
        });
    },

    setupEventListeners() {
        // Theme toggle
        this.elements.themeToggle.addEventListener('click', () => this.toggleTheme());

        // Search functionality
        this.elements.searchInput.addEventListener('input', debounce(() => this.handleSearch(), 300));
        this.elements.searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.handleSearch();
            }
        });

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
        this.elements.clearAllBtn.addEventListener('click', () => this.showConfirmDialog('Are you sure you want to clear all your rankings?', () => this.clearAllData()));

        // Share functionality
        if (this.elements.shareBtn) {
            this.elements.shareBtn.addEventListener('click', () => this.showShareModal());
        }

        // Close search results when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.elements.searchInput.contains(e.target) && !this.elements.searchResults.contains(e.target)) {
                this.elements.searchResults.classList.remove('active');
            }
        });

        // Set up drag and drop
        this.setupDragAndDrop();

        // Save data when window is closed or navigated away from
        window.addEventListener('beforeunload', () => {
            this.saveToLocalStorage();
        });
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
            document.body.classList.add('edit-mode-active');
            allCards.forEach(card => card.classList.add('edit-mode'));
            this.showToast('Edit mode activated - Click cards to remove them');
        } else {
            this.elements.editModeBtn.classList.remove('active');
            this.elements.editModeBtn.querySelector('span').textContent = 'Edit Mode: Off';
            document.body.classList.remove('edit-mode-active');
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
            this.elements.searchResults.innerHTML = '<div class="loader"></div>';
            this.elements.searchResults.classList.add('active');

            const searchType = this.state.currentSearchType;
            const data = await TMDB.searchMedia(query, searchType);

            // Process results
            let results = [];
            if (data && data.results) {
                if (searchType === 'movie') {
                    // Filter results for movie search type
                    results = data.results.filter(item =>
                        item && (item.media_type === 'movie' || item.media_type === 'tv')
                    );
                } else {
                    // For person search
                    results = data.results.filter(item =>
                        item && (item.known_for_department === 'Acting' || item.media_type === 'person')
                    );
                }

                // Limit to 6 results
                results = results.slice(0, 6);
            }

            if (results.length === 0) {
                this.elements.searchResults.innerHTML = '<p class="no-results">No results found</p>';
            } else {
                this.renderSearchResults(results);
            }
        } catch (error) {
            console.error('Error searching:', error);
            this.elements.searchResults.innerHTML = '<p class="no-results">Error searching. Please try again.</p>';
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
                ? ''
                : result.release_date || result.first_air_date);
            const imagePath = isPerson ? result.profile_path : result.poster_path;
            const mediaType = isPerson ? 'Actor' : (result.media_type === 'tv' ? 'TV Show' : 'Movie');

            const posterUrl = TMDB.getImageUrl(imagePath);

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
                this.addToPendingItems(result);
                this.elements.searchResults.classList.remove('active');
                this.elements.searchInput.value = '';
            });

            this.elements.searchResults.appendChild(resultElement);
        });
    },

    // Add selected item to pending items - handles both movies and actors
    addToPendingItems(item) {
        try {
            // Remove empty state if present
            const emptyState = this.elements.pendingItems.querySelector('.empty-state');
            if (emptyState) {
                this.elements.pendingItems.removeChild(emptyState);
            }

            // For actors, just add their image directly
            if (item.media_type === 'person' || this.state.currentSearchType === 'person') {
                const actorItem = {
                    id: item.id,
                    title: item.name,
                    poster: item.profile_path,
                    type: 'person'
                };

                if (actorItem.poster) {
                    const cardElement = this.createMovieCard(actorItem);
                    if (cardElement) {
                        this.elements.pendingItems.appendChild(cardElement);
                        this.showToast(`Added "${actorItem.title}" to your selection`);
                        this.saveToLocalStorage();
                    }
                } else {
                    this.showToast(`Cannot add ${actorItem.title} (no profile image available)`);
                }

                return;
            }

            // For movies/shows, add directly
            const mediaItem = TMDB.parseMediaItem(item);
            if (mediaItem && mediaItem.poster) {
                const cardElement = this.createMovieCard(mediaItem);
                if (cardElement) {
                    this.elements.pendingItems.appendChild(cardElement);
                    this.showToast(`Added "${mediaItem.title}" to your selection`);
                    this.saveToLocalStorage();
                }
            } else {
                this.showToast('Unable to add item (missing poster)');
            }
        } catch (error) {
            console.error('Error adding item:', error);
            this.showToast('Error adding item. Please try again.');
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
            <div class="card-inner">
                <img src="${posterUrl}" alt="${item.title}" class="card-poster" onerror="this.src='${TMDB.placeholderImage}'">
                <div class="card-actions">
                    <button class="remove-card"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `;

        // Card click handler for edit mode
        cardElement.addEventListener('click', (e) => {
            if (this.state.isEditMode) {
                this.removeCard(cardElement);
                e.stopPropagation();
            }
        });

        // Setup individual remove button
        const removeBtn = cardElement.querySelector('.remove-card');
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.removeCard(cardElement);
        });

        // Setup drag functionality
        this.setupDragForElement(cardElement);

        return cardElement;
    },

    // Remove a card with animation
    removeCard(cardElement) {
        // Add remove animation
        cardElement.classList.add('removing');

        // Wait for animation to complete
        setTimeout(() => {
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
            this.showToast(`Removed "${cardElement.dataset.title}"`);
        }, 300);
    },

    // Show empty state in a container
    showEmptyState(container, message = 'Drag items here') {
        // Clear existing content
        container.innerHTML = '';

        // Create empty state element
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        emptyState.innerHTML = `
            <i class="fas fa-film"></i>
            <p>${message}</p>
        `;
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
            element.classList.add('dragging');
        }, 0);
    },

    dragEnd(e, element) {
        element.classList.remove('dragging');
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
        const rect = container.getBoundingClientRect();
        const x = e.clientX;
        const y = e.clientY;

        // Only remove highlight if cursor is actually outside the container
        if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
            container.classList.remove('highlight');
        }
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
        draggedElement.classList.remove('dragging');

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

    // Show confirmation dialog
    showConfirmDialog(message, confirmCallback) {
        const dialog = this.elements.confirmDialog;
        dialog.querySelector('.confirm-message').textContent = message;

        // Remove previous event listener to avoid duplicates
        const confirmBtn = dialog.querySelector('.confirm-btn');
        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

        // Add new event listener
        newConfirmBtn.addEventListener('click', () => {
            confirmCallback();
            dialog.classList.remove('active');
        });

        dialog.classList.add('active');
    },

    // Share functionality
    showShareModal() {
        const shareModal = this.elements.shareModal;
        const sharePreview = shareModal.querySelector('.share-tier-table');

        // Clear previous content
        sharePreview.innerHTML = '';

        // Get original table dimensions
        const originalTable = document.querySelector('.tier-table');
        const originalWidth = originalTable.offsetWidth;

        // Temporarily expand the preview container for full rendering
        const previewContainer = shareModal.querySelector('.share-preview-container');
        previewContainer.style.maxHeight = 'none';

        // Create a new tier table for sharing (don't clone the original)
        const tierTable = document.createElement('div');
        tierTable.className = 'tier-table share-tier-table-inner';
        tierTable.style.width = `${originalWidth}px`; // Set exact width to match original

        // For each tier, create a row and copy the cards
        this.elements.tierContents.forEach(originalContainer => {
            const tier = originalContainer.dataset.tier;
            const tierName = this.getTierName(tier);

            // Create tier row
            const tierRow = document.createElement('div');
            tierRow.className = 'tier-row';

            // Create tier label
            const tierLabel = document.createElement('div');
            tierLabel.className = `tier-label ${tier}`;
            tierLabel.textContent = tierName;

            // Create tier content
            const tierContent = document.createElement('div');
            tierContent.className = 'tier-content';
            tierContent.dataset.tier = tier;
            tierContent.style.width = `${originalContainer.offsetWidth}px`; // Match original width

            // Get all cards from original container
            const originalCards = originalContainer.querySelectorAll('.movie-card');

            // If there are cards, copy them
            if (originalCards.length > 0) {
                originalCards.forEach(originalCard => {
                    // Create a simple version of the card for sharing
                    const card = document.createElement('div');
                    card.className = 'movie-card';
                    card.style.margin = '4px'; // Add some space between cards

                    const cardInner = document.createElement('div');
                    cardInner.className = 'card-inner';

                    const img = document.createElement('img');
                    img.className = 'card-poster';
                    img.src = originalCard.querySelector('img').src;
                    img.alt = originalCard.dataset.title;

                    cardInner.appendChild(img);
                    card.appendChild(cardInner);
                    tierContent.appendChild(card);
                });
            } else {
                // Add empty state
                const emptyState = document.createElement('div');
                emptyState.className = 'empty-state';
                emptyState.innerHTML = '<i class="fas fa-film"></i><p>No items</p>';
                tierContent.appendChild(emptyState);
            }

            // Assemble the row
            tierRow.appendChild(tierLabel);
            tierRow.appendChild(tierContent);

            // Add the row to the table
            tierTable.appendChild(tierRow);
        });

        // Append to preview container
        sharePreview.appendChild(tierTable);

        // Reset the preview container height for scrolling in the modal
        // but keep it expanded for html2canvas
        setTimeout(() => {
            previewContainer.style.maxHeight = '60vh';
        }, 100);

        // Show the modal
        shareModal.classList.add('active');
    },

    // Function to download the share image
    downloadShareImage() {
        const sharePreview = document.querySelector('#share-preview');

        this.showToast('Preparing image...');

        // Make sure the preview container isn't constraining the height
        const previewContainer = document.querySelector('.share-preview-container');
        const originalMaxHeight = previewContainer.style.maxHeight;
        previewContainer.style.maxHeight = 'none'; // Remove height constraint

        // Fix CORS issues by pre-loading images with crossOrigin attribute
        const images = sharePreview.querySelectorAll('img');
        let loadedImages = 0;
        const totalImages = images.length;

        if (totalImages === 0) {
            // No images to load, proceed with capture
            this.captureAndDownloadImage(sharePreview, originalMaxHeight, previewContainer);
            return;
        }

        // Load all images with crossOrigin to ensure they can be captured
        images.forEach(img => {
            const originalSrc = img.src;

            // Skip data URLs which don't have CORS issues
            if (originalSrc.startsWith('data:')) {
                loadedImages++;
                if (loadedImages === totalImages) {
                    this.captureAndDownloadImage(sharePreview, originalMaxHeight, previewContainer);
                }
                return;
            }

            // Create new image with crossOrigin set
            const newImg = new Image();
            newImg.crossOrigin = 'Anonymous';

            newImg.onload = () => {
                // Replace original image with this one
                img.src = newImg.src;

                loadedImages++;
                if (loadedImages === totalImages) {
                    // All images loaded, proceed with capture
                    this.captureAndDownloadImage(sharePreview, originalMaxHeight, previewContainer);
                }
            };

            newImg.onerror = () => {
                // If CORS fails, try with a proxy or fallback to placeholder
                img.src = TMDB.placeholderImage;

                loadedImages++;
                if (loadedImages === totalImages) {
                    this.captureAndDownloadImage(sharePreview, originalMaxHeight, previewContainer);
                }
            };

            // Add cache-busting parameter to avoid cached non-CORS responses
            newImg.src = originalSrc + (originalSrc.includes('?') ? '&' : '?') + 'cors=' + new Date().getTime();
        });
    },

    captureAndDownloadImage(element, originalMaxHeight, previewContainer) {
        // Use html2canvas to convert the preview to an image
        try {
            // Dynamically load html2canvas if not already loaded
            if (typeof html2canvas === 'undefined') {
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
                script.onload = () => this.performCapture(element, originalMaxHeight, previewContainer);
                document.head.appendChild(script);
            } else {
                this.performCapture(element, originalMaxHeight, previewContainer);
            }
        } catch (error) {
            // Restore the original max height
            if (previewContainer && originalMaxHeight) {
                previewContainer.style.maxHeight = originalMaxHeight;
            }

            console.error('Error creating image:', error);
            this.showToast('Error creating image. Please try again or take a screenshot manually.');
        }
    },

    performCapture(element, originalMaxHeight, previewContainer) {
        // Get the full dimensions of the element
        const rect = element.getBoundingClientRect();

        // Configure html2canvas
        const options = {
            backgroundColor: document.body.classList.contains('light-theme') ? '#f0f2f5' : '#121418',
            scale: 2,
            logging: false,
            useCORS: true,
            allowTaint: true,
            foreignObjectRendering: false,
            height: element.scrollHeight, // Capture full height
            width: rect.width, // Use width from bounding rect
            windowHeight: element.scrollHeight + 200, // Add padding
            windowWidth: rect.width + 100 // Add padding
        };

        html2canvas(element, options).then(canvas => {
            const image = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = 'my-rank-it-tiers.png';
            link.href = image;
            link.click();
            this.showToast('Image downloaded successfully!');

            // Restore the original max height
            if (previewContainer && originalMaxHeight) {
                previewContainer.style.maxHeight = originalMaxHeight;
            }
        }).catch(error => {
            // Restore the original max height
            if (previewContainer && originalMaxHeight) {
                previewContainer.style.maxHeight = originalMaxHeight;
            }

            console.error('Error capturing image:', error);
            this.showToast('Error creating image. Please try taking a screenshot manually.');
        });
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
            <div class="card-inner">
                <img src="${posterUrl}" alt="${item.title}" class="card-poster" onerror="this.src='${TMDB.placeholderImage}'">
                <div class="card-actions">
                    <button class="remove-card"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `;

        // Card click handler for edit mode
        cardElement.addEventListener('click', (e) => {
            if (this.state.isEditMode) {
                this.removeCard(cardElement);
                e.stopPropagation();
            }
        });

        // Setup individual remove button
        const removeBtn = cardElement.querySelector('.remove-card');
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.removeCard(cardElement);
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
            version: '1.1',
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
                    this.showConfirmDialog(
                        'Importing data will replace your current ranking. Continue?',
                        () => this.importTableData(data)
                    );
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
        } else if (message.includes('Finding') || message.includes('Loading') || message.includes('Preparing')) {
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
