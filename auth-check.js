// Auth Check - Simplified Version (No Firestore)
// Last Updated: 2025-05-27

// Collection names (kept for compatibility)
const COLLECTIONS = {
    ADMIN: 'admin',
    STUDENTS: 'Students',
    INSTRUCTORS: 'Instructor'
};

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
    
    try {
        firebase.initializeApp(firebaseConfig);
        console.log('Firebase initialized successfully');
    } catch (error) {
        console.error('Firebase initialization failed:', error);
        // Show error to user if running in browser
        if (typeof document !== 'undefined') {
            const errorDiv = document.createElement('div');
            errorDiv.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; background: #f8d7da; color: #721c24; padding: 15px; text-align: center; z-index: 9999;';
            errorDiv.textContent = 'Error initializing the application. Please refresh the page or try again later.';
            document.body.prepend(errorDiv);
        }
    }
}

// Initialize auth if not already done
if (typeof auth === 'undefined' && firebase?.auth) {
    window.auth = firebase.auth();
}

// Simple user data storage (in-memory fallback)
const userData = {
    // Default admin user (for testing)
    'admin@example.com': {
        role: ROLES.ADMIN,
        email: 'admin@example.com',
        displayName: 'Admin User',
        emailVerified: true
    }
};

// Check if current path is allowed for the user's role
function isPathAllowed(role, path) {
    const publicPaths = ['/login.html', '/create.html', '/reset-password.html', '/'];
    if (publicPaths.includes(path)) return true;
    
    const rolePaths = {
        [ROLES.ADMIN]: ['/admin/'],
        [ROLES.INSTRUCTOR]: ['/instructor/'],
        [ROLES.STUDENT]: ['/student/']
    };
    
    return rolePaths[role]?.some(allowedPath => path.startsWith(allowedPath)) || false;
}

// Get user role and data (simplified without Firestore)
async function getUserRoleAndData(user) {
    try {
        // Default role is student, but check for admin
        const isAdmin = user.email === 'admin@example.com' || user.email.endsWith('@dhvsu.edu.ph');
        const isInstructor = user.email.endsWith('@instructor.dhvsu.edu.ph');
        
        let role = ROLES.STUDENT;
        if (isAdmin) role = ROLES.ADMIN;
        else if (isInstructor) role = ROLES.INSTRUCTOR;
        
        // Create or get user data
        const userDataObj = userData[user.email] || {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || user.email.split('@')[0],
            emailVerified: user.emailVerified || true,
            role: role,
            status: 'active',
            lastLogin: new Date().toISOString(),
            permissions: {
                canManageSchedule: role === ROLES.ADMIN || role === ROLES.INSTRUCTOR,
                canManageSystem: role === ROLES.ADMIN,
                canManageUsers: role === ROLES.ADMIN
            }
        };

        // Update last login time
        userDataObj.lastLogin = new Date().toISOString();
        userData[user.email] = userDataObj;
        
        // Store user data in session storage
        sessionStorage.setItem('user', JSON.stringify(userDataObj));
        
        // Log security event
        await logSecurityEvent({
            userId: user.uid,
            eventType: 'login_success',
            ip: await getClientIP(),
            userAgent: navigator.userAgent,
            metadata: { role }
        });
        
        return {
            role,
            userData: userDataObj
        };
    } catch (error) {
        console.error('Error getting user data:', error);
        await logSecurityEvent({
            userId: user?.uid || 'unknown',
            eventType: 'login_error',
            error: error.message,
            ip: await getClientIP(),
            userAgent: navigator.userAgent
        });
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

// Session Management
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
let activityTimer;

// Reset activity timer on user interaction
function resetActivityTimer() {
    clearTimeout(activityTimer);
    activityTimer = setTimeout(async () => {
        // Auto-logout on inactivity
        const user = getCurrentUser();
        if (user) {
            try {
                await logSecurityEvent({
                    userId: user.uid,
                    eventType: 'session_timeout',
                    ip: await getClientIP()
                });
                await logout();
            } catch (error) {
                console.error('Error during auto-logout:', error);
                // Force redirect even if logging fails
                window.location.href = 'login.html';
            }
        }
    }, SESSION_TIMEOUT);
}

// Initialize activity tracking
function initActivityTracking() {
    // Reset timer on user activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => {
        document.addEventListener(event, resetActivityTimer, { passive: true });
    });
    
    // Start the initial timer
    resetActivityTimer();
}

// Enhanced logout function
async function logout() {
    try {
        const user = getCurrentUser();
        if (user) {
            await logSecurityEvent({
                userId: user.uid,
                eventType: 'logout',
                ip: await getClientIP()
            });
        }
        
        // Clear session data
        sessionStorage.removeItem('user');
        
        // Sign out from Firebase
        if (window.auth) {
            await window.auth.signOut();
        }
        
        // Redirect to login page
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Error during logout:', error);
        // Force redirect even if logout fails
        window.location.href = 'login.html';
    }
}

// Make functions available globally
window.getCurrentUser = getCurrentUser;
window.getCurrentUserRole = getCurrentUserRole;
window.hasRole = hasRole;
window.logout = logout;

// Initialize activity tracking when the page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initActivityTracking);
} else {
    initActivityTracking();
}
