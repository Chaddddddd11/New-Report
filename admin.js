// Import Firebase services and helper functions
import { auth, db, getDashboardUrl } from './config.js';
import { 
    showLoading, 
    showAlert, 
    generatePassword 
} from './admin-helpers.js';

// Import user management functions
import { 
    loadUsers, 
    renderUsers, 
    updateStats, 
    addUserActionListeners 
} from './admin-users.js';

// Import CRUD operations
import { 
    viewUser, 
    editUser, 
    handleAddUser, 
    handleUpdateUser, 
    confirmDeleteUser, 
    handleDeleteUser 
} from './admin-crud.js';

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

// Global state
let currentUser = null;
let users = [];
let currentEditUserId = null;

// Make functions available globally for HTML event handlers
window.viewUser = viewUser;
window.editUser = editUser;
window.confirmDeleteUser = confirmDeleteUser;
window.handleDeleteUser = handleDeleteUser;
window.handleLogout = handleLogout;

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    // Check authentication state
    const initAuthState = async () => {
        try {
            const user = auth.currentUser;
            if (user) {
                // Get the user's token to verify their role
                const idTokenResult = await user.getIdTokenResult();
                const userRole = idTokenResult.claims.role;
                
                // Only allow admin users to access the admin panel
                if (userRole !== 'admin') {
                    showAlert('You do not have permission to access this page.', 'danger');
                    window.location.href = getDashboardUrl(userRole);
                    return;
                }
                
                currentUser = user;
                await loadUsers();
                setupEventListeners();
            } else {
                // Redirect to login page if not authenticated
                window.location.href = 'login.html';
            }
        } catch (error) {
            console.error('Error checking user role:', error);
            showAlert('An error occurred while verifying your permissions.', 'danger');
            await auth.signOut();
            window.location.href = 'login.html';
        }
    };
    
    // Setup event listeners
    const setupEventListeners = () => {
        // Logout button
        if (logoutBtn) {
            logoutBtn.addEventListener('click', handleLogout);
        }
        
        // Generate password button
        if (generatePasswordBtn) {
            generatePasswordBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const password = generatePassword();
                if (passwordInput) {
                    passwordInput.value = password;
                    passwordInput.type = 'text';
                    
                    // Show copy to clipboard button
                    const copyBtn = document.createElement('button');
                    copyBtn.type = 'button';
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

        // Add user form submission
        if (addUserForm) {
            addUserForm.addEventListener('submit', handleAddUser);
        }

        // Edit user form submission
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



        // Search input event
        if (userSearch) {
            userSearch.addEventListener('input', (e) => {
                const searchTerm = e.target.value.toLowerCase();
                const filteredUsers = users.filter(user => 
                    (user.displayName && user.displayName.toLowerCase().includes(searchTerm)) ||
                    (user.email && user.email.toLowerCase().includes(searchTerm))
                );
                renderUsers(filteredUsers);
            });
        }
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
});

// Handle logout
async function handleLogout(e) {
    if (e) e.preventDefault();
    
    try {
        showLoading(true);
        await auth.signOut();
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Error signing out:', error);
        showAlert('Error signing out. Please try again.', 'danger');
    } finally {
        showLoading(false);
    }
}

// Make handleLogout available globally
window.handleLogout = handleLogout;

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
