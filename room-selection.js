/**
 * Room Selection Module
 * Handles room selection UI and functionality
 */

class RoomSelection {
    constructor(options = {}) {
        // Default options
        this.options = {
            containerSelector: '.room-selection',
            roomGridSelector: '.room-grid',
            searchInputSelector: '.room-search input',
            filtersSelector: '.room-filters select',
            roomCardSelector: '.room-card',
            selectedRoomInput: '#selectedRoom',
            onRoomSelect: null,
            ...options
        };

        // DOM elements
        this.container = document.querySelector(this.options.containerSelector);
        if (!this.container) return;
        
        this.roomGrid = this.container.querySelector(this.options.roomGridSelector);
        this.searchInput = this.container.querySelector(this.options.searchInputSelector);
        this.filterSelects = this.container.querySelectorAll(this.options.filtersSelector);
        this.roomCards = this.container.querySelectorAll(this.options.roomCardSelector);
        this.selectedRoomInput = document.querySelector(this.options.selectedRoomInput);
        
        // State
        this.rooms = [];
        this.selectedRoom = null;
        this.filters = {
            search: '',
            building: 'all',
            capacity: 'all',
            type: 'all'
        };

        this.init();
    }

    init() {
        // Initialize event listeners
        this.setupEventListeners();
        
        // Load rooms (in a real app, this would be an API call)
        this.loadRooms();
    }


    setupEventListeners() {
        // Toggle room selection
        const header = this.container?.querySelector('.room-selection-header');
        if (header) {
            header.addEventListener('click', () => {
                const expanded = header.getAttribute('aria-expanded') === 'true' || false;
                header.setAttribute('aria-expanded', !expanded);
                const content = header.nextElementSibling;
                content.setAttribute('aria-hidden', expanded);
            });
        }

        // Search input
        if (this.searchInput) {
            this.searchInput.addEventListener('input', (e) => {
                this.filters.search = e.target.value.toLowerCase();
                this.filterRooms();
            });
        }

        // Filter selects
        this.filterSelects.forEach(select => {
            select.addEventListener('change', (e) => {
                this.filters[select.name] = e.target.value;
                this.filterRooms();
            });
        });

        // Room card selection
        this.roomGrid?.addEventListener('click', (e) => {
            const roomCard = e.target.closest(this.options.roomCardSelector);
            if (!roomCard || roomCard.classList.contains('occupied')) return;
            
            const roomId = roomCard.dataset.roomId;
            this.selectRoom(roomId);
        });
    }


    async loadRooms() {
        try {
            // Show loading state
            this.showLoading();
            
            // In a real app, this would be an API call
            // Example: const response = await fetch('/api/rooms');
            // this.rooms = await response.json();
            
            // For demo purposes, we'll use sample data
            this.rooms = this.getSampleRooms();
            
            // Render rooms
            this.renderRooms(this.rooms);
            
        } catch (error) {
            console.error('Error loading rooms:', error);
            this.showError('Failed to load rooms. Please try again.');
        } finally {
            this.hideLoading();
        }
    }
    
    getSampleRooms() {
        // This is sample data - replace with actual API call
        return [
            { id: 'rm-101', name: 'Room 101', building: 'Main', capacity: 30, type: 'Lecture', available: true },
            { id: 'rm-102', name: 'Room 102', building: 'Main', capacity: 25, type: 'Lab', available: true },
            { id: 'rm-201', name: 'Room 201', building: 'Annex', capacity: 50, type: 'Lecture', available: false },
            { id: 'rm-202', name: 'Room 202', building: 'Annex', capacity: 40, type: 'Lecture', available: true },
            { id: 'lab-101', name: 'Computer Lab', building: 'Tech', capacity: 20, type: 'Lab', available: true },
            { id: 'conf-1', name: 'Conference Room', building: 'Main', capacity: 15, type: 'Conference', available: true }
        ];
    }
    
    filterRooms() {
        if (!this.rooms.length) return;
        
        const filteredRooms = this.rooms.filter(room => {
            // Search filter
            const matchesSearch = room.name.toLowerCase().includes(this.filters.search) ||
                               room.building.toLowerCase().includes(this.filters.search);
            
            // Building filter
            const matchesBuilding = this.filters.building === 'all' || 
                                 room.building === this.filters.building;
            
            // Capacity filter
            let matchesCapacity = true;
            if (this.filters.capacity !== 'all') {
                const [min, max] = this.filters.capacity.split('-').map(Number);
                if (max) {
                    matchesCapacity = room.capacity >= min && room.capacity <= max;
                } else {
                    matchesCapacity = room.capacity >= min;
                }
            }
            
            // Type filter
            const matchesType = this.filters.type === 'all' || 
                             room.type === this.filters.type;
            
            return matchesSearch && matchesBuilding && matchesCapacity && matchesType;
        });
        
        this.renderRooms(filteredRooms);
    }
    
    renderRooms(rooms) {
        if (!this.roomGrid) return;
        
        if (!rooms.length) {
            this.roomGrid.innerHTML = `
                <div class="room-empty-state">
                    <h3>No rooms found</h3>
                    <p>Try adjusting your filters or search term</p>
                </div>
            `;
            return;
        }
        
        this.roomGrid.innerHTML = rooms.map(room => `
            <div class="room-card ${!room.available ? 'occupied' : ''} ${this.selectedRoom === room.id ? 'selected' : ''}" 
                 data-room-id="${room.id}">
                <div class="room-name">${room.name}</div>
                <div class="room-details">
                    <div>${room.building} Building</div>
                    <div>${room.type}</div>
                </div>
                <div class="room-capacity">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                    ${room.capacity} persons
                </div>
            </div>
        `).join('');
    }
    
    selectRoom(roomId) {
        if (this.selectedRoom === roomId) {
            // Deselect if clicking the same room
            this.selectedRoom = null;
        } else {
            this.selectedRoom = roomId;
        }
        
        // Update UI
        this.roomGrid?.querySelectorAll(this.options.roomCardSelector).forEach(card => {
            if (card.dataset.roomId === roomId) {
                card.classList.toggle('selected');
            } else {
                card.classList.remove('selected');
            }
        });
        
        // Update hidden input if it exists
        if (this.selectedRoomInput) {
            this.selectedRoomInput.value = this.selectedRoom || '';
        }
        
        // Callback if provided
        if (typeof this.options.onRoomSelect === 'function') {
            const selectedRoomData = this.rooms.find(r => r.id === roomId);
            this.options.onRoomSelect(selectedRoomData || null);
        }
    }
    
    showLoading() {
        if (this.roomGrid) {
            this.roomGrid.innerHTML = `
                <div class="room-empty-state">
                    <div class="loading-spinner"></div>
                    <p>Loading rooms...</p>
                </div>
            `;
        }
    }
    
    hideLoading() {
        // Loading state is automatically cleared when rendering rooms
    }
    
    showError(message) {
        if (this.roomGrid) {
            this.roomGrid.innerHTML = `
                <div class="room-empty-state">
                    <div class="error-icon">⚠️</div>
                    <p>${message}</p>
                    <button class="btn btn-sm btn-outline" onclick="location.reload()">
                        Try Again
                    </button>
                </div>
            `;
        }
    }
}

// Auto-initialize if script is included in page
document.addEventListener('DOMContentLoaded', () => {
    const roomSelection = new RoomSelection({
        // You can pass custom options here
        onRoomSelect: (room) => {
            console.log('Room selected:', room);
            // Handle room selection (e.g., update form, show details, etc.)
        }
    });
    
    // Make it available globally if needed
    window.roomSelection = roomSelection;
});