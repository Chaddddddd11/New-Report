// Import helper functions and modules
import { 
    showLoading, 
    showAlert, 
    formatTimeAgo, 
    generatePassword, 
    setUserRole, 
    getDashboardUrl 
} from './admin-helpers.js';

// Initialize Firebase with config from config.js
// Note: Make sure config.js is included before admin.js in your HTML
const auth = firebase.auth();
const db = firebase.firestore();

// DOM Elements
const usersTableBody = document.getElementById('usersTableBody');
const addUserForm = document.getElementById('addUserForm');
const editUserForm = document.getElementById('editUserForm');
const logoutBtn = document.getElementById('logoutBtn');
const generatePasswordBtn = document.getElementById('generatePassword');
const passwordInput = document.getElementById('password');
const saveUserBtn = document.getElementById('saveUserBtn');
const updateUserBtn = document.getElementById('updateUserBtn');
const deleteUserBtn = document.getElementById('deleteUserBtn');
const editUserFromViewBtn = document.getElementById('editUserFromViewBtn');
const userSearch = document.getElementById('userSearch');

// State
let currentUser = null;
let users = [];
let currentEditUserId = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    initAuthState();
    setupEventListeners();
});

// Check authentication state
function initAuthState() {
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            const token = await user.getIdTokenResult(true); // Force token refresh
            
            // Check if user has admin role
            if (token.claims.role !== 'admin') {
                // Redirect non-admin users to their respective dashboards
                window.location.href = getDashboardUrl(token.claims.role);
                return;
            }
            
            // Load users
            loadUsers(auth, db, showLoading, showAlert, renderUsers, updateStats);
            
            // Update UI for admin
            updateAdminUI();
            
        } else {
            // Not logged in, redirect to login
            window.location.href = 'login.html';
        }
    });
}

// Setup event listeners
function setupEventListeners() {
    // Logout button
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    
    // Generate password button
    if (generatePasswordBtn) {
        generatePasswordBtn.addEventListener('click', () => {
            const password = generatePassword();
            if (passwordInput) {
                passwordInput.value = password;
                passwordInput.type = 'text';
                
                // Show copy to clipboard button
                const copyBtn = document.createElement('button');
                copyBtn.className = 'btn btn-sm btn-outline-secondary ms-2';
                copyBtn.innerHTML = '<i class="far fa-copy"></i>';
                copyBtn.title = 'Copy to clipboard';
                copyBtn.onclick = (e) => {
                    e.preventDefault();
                    passwordInput.select();
                    document.execCommand('copy');
                    showAlert('Password copied to clipboard!', 'success');
                    return false;
                };
                
                const inputGroup = passwordInput.closest('.input-group');
                if (inputGroup) {
                    // Remove existing copy button if any
                    const existingBtn = inputGroup.querySelector('.copy-password-btn');
                    if (existingBtn) {
                        existingBtn.remove();
                    }
                    
                    // Add new copy button
                    const wrapper = document.createElement('div');
                    wrapper.className = 'input-group-append copy-password-btn';
                    wrapper.appendChild(copyBtn);
                    inputGroup.appendChild(wrapper);
                }
            }
        });
    }
    
    // Save new user
    if (addUserForm) {
        addUserForm.addEventListener('submit', handleAddUser);
    }
    
    // Update user
    if (editUserForm) {
        editUserForm.addEventListener('submit', handleUpdateUser);
    }
    
    // Delete user confirmation
    if (deleteUserBtn) {
        deleteUserBtn.addEventListener('click', handleDeleteUser);
    }
    
    // Edit user from view modal
    if (editUserFromViewBtn) {
        editUserFromViewBtn.addEventListener('click', () => {
            const viewModal = bootstrap.Modal.getInstance(document.getElementById('viewUserModal'));
            viewModal.hide();
            
            if (currentEditUserId) {
                editUser(currentEditUserId);
            }
        });
    }
    
    // User search
    if (userSearch) {
        userSearch.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            filterUsers(searchTerm);
        });
    }
    
    // Modal hidden events
    const modals = ['addUserModal', 'editUserModal', 'viewUserModal', 'deleteUserModal'];
    modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.addEventListener('hidden.bs.modal', () => {
                // Reset form
                const form = modal.querySelector('form');
                if (form) {
                    form.reset();
                }
                
                // Clear validation
                const invalidInputs = modal.querySelectorAll('.is-invalid');
                invalidInputs.forEach(input => {
                    input.classList.remove('is-invalid');
                });
                
                // Clear error messages
                const errorAlerts = modal.querySelectorAll('.invalid-feedback');
                errorAlerts.forEach(alert => alert.remove());
                
                // Reset buttons
                const buttons = modal.querySelectorAll('button[type="submit"]');
                buttons.forEach(btn => {
                    btn.disabled = false;
                    if (btn.querySelector('.spinner-border')) {
                        btn.innerHTML = btn.getAttribute('data-original-text') || 'Submit';
                    }
                });
            });
        }
    });
}

// Handle logout
async function handleLogout(e) {
    e.preventDefault();
    
    try {
        await auth.signOut();
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Error signing out:', error);
        showAlert('Failed to sign out. Please try again.', 'danger');
    }
}

// Filter users based on search input
function filterUsers(searchTerm) {
    if (!searchTerm) {
        renderUsers(users);
        return;
    }
    
    const filteredUsers = users.filter(user => {
        return (
            (user.displayName && user.displayName.toLowerCase().includes(searchTerm)) ||
            (user.email && user.email.toLowerCase().includes(searchTerm)) ||
            (user.role && user.role.toLowerCase().includes(searchTerm))
        );
    });
    
    renderUsers(filteredUsers);
}

// Update UI for admin user
function updateAdminUI() {
    // Update user info in navbar if exists
    const userInfoElement = document.getElementById('userInfo');
    if (userInfoElement && currentUser) {
        userInfoElement.textContent = currentUser.displayName || currentUser.email;
    }
    
    // Set current year in footer
    const yearElement = document.getElementById('currentYear');
    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }
    
    // Set up tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
    
    // Set up popovers
    const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
    popoverTriggerList.map(function (popoverTriggerEl) {
        return new bootstrap.Popover(popoverTriggerEl);
    });
}

// Make functions available globally for HTML event handlers
window.viewUser = viewUser;
window.editUser = editUser;
window.confirmDeleteUser = confirmDeleteUser;
window.handleDeleteUser = handleDeleteUser;
