// Import Firebase services
import { auth } from './config.js';

// Helper functions for admin panel

// Format time as "time ago"
export function formatTimeAgo(date) {
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    let interval = Math.floor(seconds / 31536000);
    if (interval >= 1) {
        return interval + ' year' + (interval === 1 ? '' : 's') + ' ago';
    }
    
    interval = Math.floor(seconds / 2592000);
    if (interval >= 1) {
        return interval + ' month' + (interval === 1 ? '' : 's') + ' ago';
    }
    
    interval = Math.floor(seconds / 86400);
    if (interval >= 1) {
        return interval + ' day' + (interval === 1 ? '' : 's') + ' ago';
    }
    
    interval = Math.floor(seconds / 3600);
    if (interval >= 1) {
        return interval + ' hour' + (interval === 1 ? '' : 's') + ' ago';
    }
    
    interval = Math.floor(seconds / 60);
    if (interval >= 1) {
        return interval + ' minute' + (interval === 1 ? '' : 's') + ' ago';
    }
    
    return 'Just now';
}

// Show loading state
export function showLoading(show = true) {
    const loadingElement = document.getElementById('loadingIndicator');
    if (loadingElement) {
        loadingElement.style.display = show ? 'flex' : 'none';
    }
}

// Show alert message
export function showAlert(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.role = 'alert';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    const container = document.querySelector('.container');
    if (container) {
        container.insertBefore(alertDiv, container.firstChild);
    }
    
    // Auto dismiss after 5 seconds
    setTimeout(() => {
        const alert = bootstrap.Alert.getOrCreateInstance(alertDiv);
        if (alert) {
            alert.close();
        }
    }, 5000);
}

// Generate random password
export function generatePassword() {
    const length = 12;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()';
    let password = '';
    
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * charset.length);
        password += charset[randomIndex];
    }
    
    return password;
}

// Set user role in custom claims
export async function setUserRole(uid, role) {
    try {
        // Set custom claim
        await auth.setCustomUserClaims(uid, { role });
        return true;
    } catch (error) {
        console.error('Error setting user role:', error);
        throw error;
    }
}

// Get dashboard URL based on role
export function getDashboardUrl(role) {
    switch(role) {
        case 'instructor':
            return 'instructor-dashboard.html';
        case 'student':
            return 'student-dashboard.html';
        case 'admin':
            return 'admin-panel.html';
        default:
            return 'home.html';
    }
}
