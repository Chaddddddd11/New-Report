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
});

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
    
    try {
        isSubmitting = true;
        setLoading(true);
        
        const formData = getFormData();
        const validationResult = validateFormData(formData);
        
        if (!validationResult.isValid) {
            showError(validationResult.message);
            return;
        }
        
        // Check room availability
        const isRoomAvailable = await checkRoomAvailability(formData);
        if (!isRoomAvailable) {
            showError('The selected room is not available at the chosen time.');
            return;
        }
        
        // Save instructor data
        await saveInstructor(formData);
        showSuccess('Instructor enrolled successfully!');
        form.reset();
        
    } catch (error) {
        console.error('Form submission error:', error);
        showError('An error occurred. Please try again.');
    } finally {
        setLoading(false);
        isSubmitting = false;
    }
}

function getFormData() {
    return {
        name: document.getElementById('name')?.value,
        email: document.getElementById('email')?.value,
        department: document.getElementById('department')?.value,
        course: document.getElementById('course')?.value,
        year: document.getElementById('year')?.value,
        section: document.getElementById('section')?.value,
        room: document.getElementById('room')?.value,
        day: document.getElementById('day')?.value,
        time: document.getElementById('time')?.value,
        scheduleColor: document.getElementById('scheduleColor')?.value
    };
}

function validateFormData(data) {
    // Basic validation - expand as needed
    if (!data.name) return { isValid: false, message: 'Instructor name is required' };
    if (!data.email) return { isValid: false, message: 'Email is required' };
    if (!data.course) return { isValid: false, message: 'Course is required' };
    if (!data.room) return { isValid: false, message: 'Room is required' };
    if (!data.day) return { isValid: false, message: 'Day is required' };
    if (!data.time) return { isValid: false, message: 'Time is required' };
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
        return { isValid: false, message: 'Please enter a valid email address' };
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
