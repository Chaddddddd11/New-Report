// Firebase Configuration
const firebaseConfig = {
    // Your Firebase config here - should be moved to environment variables in production
    apiKey: "YOUR_API_KEY",
    authDomain: "your-app.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-app.appspot.com",
    messagingSenderId: "1234567890",
    appId: "1:1234567890:web:abcdef123456"
};

// Initialize Firebase
try {
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    console.log('Firebase initialized successfully');
} catch (error) {
    console.error('Firebase initialization error:', error);
    showError('Failed to initialize the application. Please try again later.');
}

// DOM Elements
const form = document.getElementById('instructorForm');
const submitBtn = document.getElementById('submitBtn');
const loadingSpinner = document.createElement('span');
loadingSpinner.className = 'spinner';
loadingSpinner.setAttribute('aria-hidden', 'true');

// Form State
let isSubmitting = false;

// Student capacity mapping (should be moved to a configuration file in production)
const studentCapacityMap = {
    'BSA': {
        '1st': { 'A': 30, 'B': 30, 'C': 30, 'D': 30 },
        '2nd': { 'A': 25, 'B': 25, 'C': 25, 'D': 25 },
        '3rd': { 'A': 20, 'B': 20, 'C': 20, 'D': 20 },
        '4th': { 'A': 15, 'B': 15, 'C': 15, 'D': 15 }
    },
    // Add other courses as needed
};

// Initialize the form
document.addEventListener('DOMContentLoaded', () => {
    initializeForm();
    setupEventListeners();
    
    // Initialize room selection
    initializeRoomSelection();
});

// Room Selection
let roomSelectionInstance = null;

function initializeRoomSelection() {
    // Wait for the DOM to be fully loaded
    if (!document.querySelector('.room-selection')) {
        console.warn('Room selection element not found');
        return;
    }
    
    roomSelectionInstance = new RoomSelection({
        onRoomSelect: (room) => {
            if (room) {
                // Update the hidden input
                document.getElementById('selectedRoom').value = room.id;
                
                // Show the selected room display
                const display = document.getElementById('selectedRoomDisplay');
                const nameSpan = document.getElementById('selectedRoomName');
                
                nameSpan.textContent = `${room.name} (${room.building} - ${room.type}, ${room.capacity} persons)`;
                display.style.display = 'block';
                
                // Hide the room selection dropdown
                const content = document.querySelector('.room-selection-content');
                const header = document.querySelector('.room-selection-header');
                if (content && header) {
                    content.setAttribute('aria-hidden', 'true');
                    header.setAttribute('aria-expanded', 'false');
                }
                
                // Update the form validation
                validateRoomSelection();
            }
        }
    });
    
    // Handle change room button
    const changeRoomBtn = document.getElementById('changeRoomBtn');
    if (changeRoomBtn) {
        changeRoomBtn.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('selectedRoomDisplay').style.display = 'none';
            document.getElementById('selectedRoom').value = '';
            
            // Show the room selection dropdown
            const content = document.querySelector('.room-selection-content');
            const header = document.querySelector('.room-selection-header');
            if (content && header) {
                content.setAttribute('aria-hidden', 'false');
                header.setAttribute('aria-expanded', 'true');
            }
        });
    }
}

function validateRoomSelection() {
    const roomInput = document.getElementById('selectedRoom');
    const isValid = roomInput.value.trim() !== '';
    
    // Update UI to show validation state
    const roomGroup = roomInput.closest('.form-group');
    if (roomGroup) {
        if (isValid) {
            roomGroup.classList.remove('error');
        } else {
            roomGroup.classList.add('error');
        }
    }
    
    return isValid;
}

function initializeForm() {
    // Initialize form fields and event listeners
    const colorInput = document.getElementById('scheduleColor');
    const colorPreview = document.getElementById('colorPreview');
    
    if (colorInput && colorPreview) {
        colorInput.addEventListener('input', (e) => {
            colorPreview.style.backgroundColor = e.target.value;
        });
        
        // Set initial color preview
        colorPreview.style.backgroundColor = colorInput.value || '#610000';
    }
}

function setupEventListeners() {
    // Form submission
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
    }
    
    // Course/Year/Section change handlers
    const courseSelect = document.getElementById('course');
    const yearSelect = document.getElementById('year');
    const sectionSelect = document.getElementById('section');
    
    if (courseSelect) courseSelect.addEventListener('change', updateStudentCapacity);
    if (yearSelect) yearSelect.addEventListener('change', updateStudentCapacity);
    if (sectionSelect) sectionSelect.addEventListener('change', updateStudentCapacity);
}

async function handleFormSubmit(e) {
    e.preventDefault();
    
    if (isSubmitting) return;
    
    setLoading(true);
    
    try {
        const formData = getFormData();
        const validation = validateFormData(formData);
        
        if (!validation.valid) {
            showError(validation.message);
            setLoading(false);
            return;
        }
        
        // Check room availability
        const isRoomAvailable = await checkRoomAvailability(formData);
        
        if (!isRoomAvailable) {
            showError('The selected room is not available at the chosen time.');
            setLoading(false);
            return;
        }
        
        // Get the selected room data
        const selectedRoomId = document.getElementById('selectedRoom').value;
        const roomSelection = roomSelectionInstance?.rooms?.find(r => r.id === selectedRoomId);
        
        if (roomSelection) {
            // Add room details to form data
            formData.roomName = roomSelection.name;
            formData.roomBuilding = roomSelection.building;
            formData.roomCapacity = roomSelection.capacity;
        }
        
        // Save instructor data
        await saveInstructor(formData);
        
        // Show success message
        showSuccess('Instructor enrolled successfully!');
        
        // Reset form
        form.reset();
        
        // Reset room selection
        if (roomSelectionInstance) {
            roomSelectionInstance.selectedRoom = null;
            document.getElementById('selectedRoom').value = '';
            document.getElementById('selectedRoomDisplay').style.display = 'none';
            const roomGrid = document.querySelector('.room-grid');
            if (roomGrid) roomGrid.innerHTML = '';
        }
        
    } catch (error) {
        console.error('Error submitting form:', error);
        showError('An error occurred. Please try again.');
    } finally {
        setLoading(false);
    }
}

function getFormData() {
    const formData = {};
    const formElements = form.elements;
    
    for (let element of formElements) {
        if (element.name && element.type !== 'button') {
            if (element.type === 'checkbox') {
                formData[element.name] = element.checked;
            } else if (element.type === 'radio') {
                if (element.checked) {
                    formData[element.name] = element.value;
                }
            } else {
                formData[element.name] = element.value;
            }
        }
    }
    
    // Add selected room data if available
    const selectedRoomId = document.getElementById('selectedRoom')?.value;
    if (selectedRoomId) {
        formData.room = selectedRoomId;
    }
    
    // Add any additional fields that might not be caught by the form elements loop
    const additionalFields = {
        email: document.getElementById('email')?.value,
        department: document.getElementById('department')?.value,
        course: document.getElementById('course')?.value,
        year: document.getElementById('year')?.value,
        section: document.getElementById('section')?.value,
        day: document.getElementById('day')?.value,
        time: document.getElementById('time')?.value,
        scheduleColor: document.getElementById('scheduleColor')?.value
    };
    
    // Merge additional fields into formData
    Object.assign(formData, additionalFields);
    
    return formData;
}

function validateFormData(data) {
    // Check required fields
    const requiredFields = ['name', 'employeeId', 'department', 'subject', 'room', 'day', 'time'];
    const missingFields = requiredFields.filter(field => !data[field]?.trim());
    
    if (missingFields.length > 0) {
        return { valid: false, message: `Please fill in all required fields: ${missingFields.join(', ')}` };
    }
    
    // Validate room selection
    if (!validateRoomSelection()) {
        return { valid: false, message: 'Please select a valid room' };
    }
    
    // Email validation if email field exists
    if (data.email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(data.email)) {
            return { valid: false, message: 'Please enter a valid email address' };
        }
    }
    
    return { isValid: true };
}

async function checkRoomAvailability(formData) {
    // Implement room availability check
    // This is a placeholder - implement actual Firebase query
    return true;
}

async function saveInstructor(data) {
    // Implement Firebase save logic
    // This is a placeholder - implement actual Firebase save
    const docRef = await addDoc(collection(db, "Instructors"), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
    
    return docRef.id;
}

function updateStudentCapacity() {
    const course = document.getElementById('course')?.value;
    const year = document.getElementById('year')?.value;
    const section = document.getElementById('section')?.value;
    
    if (course && year && section) {
        const capacity = studentCapacityMap[course]?.[year]?.[section] || 'N/A';
        const capacityElement = document.getElementById('studentCapacity');
        if (capacityElement) {
            capacityElement.textContent = `Max Students: ${capacity}`;
        }
    }
}

// UI Helper Functions
function setLoading(isLoading) {
    if (isLoading) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Processing...';
        submitBtn.prepend(loadingSpinner);
    } else {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Enroll Instructor';
        const spinner = submitBtn.querySelector('.spinner');
        if (spinner) spinner.remove();
    }
}

function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        errorDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function showSuccess(message) {
    const successDiv = document.getElementById('successMessage');
    if (successDiv) {
        successDiv.textContent = message;
        successDiv.style.display = 'block';
        successDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Hide after 5 seconds
        setTimeout(() => {
            successDiv.style.display = 'none';
        }, 5000);
    }
}

// Export functions for testing if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        validateFormData,
        updateStudentCapacity,
        studentCapacityMap
    };
}
