// Auth Check - Simplified Version (No Firestore)
// Last Updated: 2025-05-27

// User roles
const ROLES = {
    ADMIN: 'admin',
    INSTRUCTOR: 'instructor',
    STUDENT: 'student'
};

// Initialize Firebase if not already initialized
if (typeof firebase !== 'undefined' && !firebase.apps.length) {
    const firebaseConfig = {
        // Your Firebase config here
        apiKey: "YOUR_API_KEY",
        authDomain: "YOUR_AUTH_DOMAIN",
        projectId: "YOUR_PROJECT_ID",
        storageBucket: "YOUR_STORAGE_BUCKET",
        messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
        appId: "YOUR_APP_ID"
    };
    
    firebase.initializeApp(firebaseConfig);
}

// Initialize auth if not already done
if (typeof auth === 'undefined' && firebase?.auth) {
    window.auth = firebase.auth();
}

// Simple user data storage
const userData = {
    // Default admin user (for testing)
    'admin@example.com': {
        role: ROLES.ADMIN,
        email: 'admin@example.com',
        displayName: 'Admin User',
        emailVerified: true
    }
};

// Get user role and data (simplified without Firestore)
async function getUserRoleAndData(user) {
    try {
        // Default role is student, but check for admin
        const isAdmin = user.email === 'admin@example.com' || user.email.endsWith('@dhvsu.edu.ph');
        const role = isAdmin ? ROLES.ADMIN : ROLES.STUDENT;
        
        // Create or get user data
        const userDataObj = userData[user.email] || {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || user.email.split('@')[0],
            emailVerified: user.emailVerified || true,
            role: role,
            status: 'active',
            lastLogin: new Date().toISOString()
        };

        // Store user data in session storage
        sessionStorage.setItem('user', JSON.stringify(userDataObj));
        
        return {
            role: role,
            userData: userDataObj
        };
    } catch (error) {
        console.error('Error getting user data:', error);
        throw error;
    }
}

// Handle successful login
async function handleSuccessfulLogin(user) {
    try {
        // Get user role and data
        const { role, userData } = await getUserRoleAndData(user);
        
        // Store user data in session storage
        sessionStorage.setItem('user', JSON.stringify({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || userData.displayName || '',
            role: role,
            emailVerified: user.emailVerified || true
        }));
        
        // Redirect based on role
        const redirectPath = getRedirectPath(role);
        if (window.location.pathname !== redirectPath) {
            window.location.href = redirectPath;
        }
    } catch (error) {
        console.error('Login error:', error);
        window.location.href = 'login.html?error=login_failed';
    }
}

// Get redirect path based on role
function getRedirectPath(role) {
    switch (role) {
        case ROLES.ADMIN:
            return '/admin/dashboard.html';
        case ROLES.INSTRUCTOR:
            return '/instructor/dashboard.html';
        case ROLES.STUDENT:
        default:
            return '/student/dashboard.html';
    }
}

// Initialize auth state listener
function initAuthStateListener() {
    if (!auth) {
        console.error('Auth not initialized');
        return;
    }
    
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            // User is signed in
            await handleSuccessfulLogin(user);
        } else {
            // User is signed out
            if (!isPublicPage()) {
                // Store the current URL for redirecting back after login
                sessionStorage.setItem('redirectAfterLogin', window.location.pathname);
                window.location.href = 'login.html';
            }
        }
    });
}

// Check if current page is public
function isPublicPage() {
    const publicPages = ['/login.html', '/create.html', '/reset-password.html'];
    return publicPages.includes(window.location.pathname);
}

// Initialize the application
function initApp() {
    // Initialize auth state listener
    initAuthStateListener();
    
    // Add logout functionality to all logout buttons
    document.querySelectorAll('.logout-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            auth.signOut().then(() => {
                window.location.href = 'login.html';
            });
        });
    });
}

// Start the application when the page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

// Utility functions for other scripts
function getCurrentUser() {
    const user = auth?.currentUser;
    if (user) {
        const storedUser = JSON.parse(sessionStorage.getItem('user') || '{}');
        return { ...user, ...storedUser };
    }
    return null;
}

function getCurrentUserRole() {
    const user = getCurrentUser();
    return user?.role || null;
}

function hasRole(requiredRole) {
    const userRole = getCurrentUserRole();
    if (!userRole) return false;
    
    // Admin has access to everything
    if (userRole === ROLES.ADMIN) return true;
    
    return userRole === requiredRole;
}

// Make functions available globally
window.getCurrentUser = getCurrentUser;
window.getCurrentUserRole = getCurrentUserRole;
window.hasRole = hasRole;
