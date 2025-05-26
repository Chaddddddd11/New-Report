// Role-based access control configuration
const ROLES = {
    ADMIN: 'admin',
    INSTRUCTOR: 'instructor',
    STUDENT: 'student'
};

// Define which roles can access which routes
const ROLE_ACCESS = {
    // Public routes (no authentication required)
    'login.html': [ROLES.ADMIN, ROLES.INSTRUCTOR, ROLES.STUDENT],
    'create.html': [ROLES.ADMIN],
    'forgot.html': [ROLES.ADMIN, ROLES.INSTRUCTOR, ROLES.STUDENT],
    
    // Student accessible pages
    'home.html': [ROLES.ADMIN, ROLES.INSTRUCTOR, ROLES.STUDENT],
    'index.html': [ROLES.ADMIN, ROLES.INSTRUCTOR, ROLES.STUDENT],
    
    // Admin only routes
    'admin-dashboard.html': [ROLES.ADMIN],
    'manage-users.html': [ROLES.ADMIN],
    'RoomList.html': [ROLES.ADMIN],
    'InstructorList.html': [ROLES.ADMIN],
    'EditInstructor.html': [ROLES.ADMIN],
    
    // Instructor accessible pages
    'Instructor.html': [ROLES.ADMIN, ROLES.INSTRUCTOR],
    'Room.html': [ROLES.ADMIN, ROLES.INSTRUCTOR],
    'bulk-upload-final.html': [ROLES.ADMIN, ROLES.INSTRUCTOR],
    
    // Other restricted pages (admin only by default)
    'student-dashboard.html': [ROLES.ADMIN],
    'view-schedule.html': [ROLES.ADMIN],
    'instructor-dashboard.html': [ROLES.ADMIN],
    'my-schedule.html': [ROLES.ADMIN],
    
    // Catch-all for admin access to all other pages
    '*': [ROLES.ADMIN]
};

// Function to check if a user has access to a specific page
function hasAccess(userRole, page) {
    // If page is not specified, default to current page
    page = page || getCurrentPage();
    
    // Admin has access to everything
    if (userRole === ROLES.ADMIN) return true;
    
    // Check if there are specific rules for this page
    if (ROLE_ACCESS[page]) {
        return ROLE_ACCESS[page].includes(userRole);
    }
    
    // If no specific rules, check for wildcard
    if (ROLE_ACCESS['*']) {
        return ROLE_ACCESS['*'].includes(userRole);
    }
    
    // Default deny
    return false;
}

// Default redirects based on role
const DEFAULT_ROUTE = {
    [ROLES.ADMIN]: 'admin-dashboard.html',
    [ROLES.INSTRUCTOR]: 'instructor-dashboard.html',
    [ROLES.STUDENT]: 'student-dashboard.html'
};

// Get current page
function getCurrentPage() {
    return window.location.pathname.split('/').pop() || 'index.html';
}

// Check if user has access to the current page
async function checkRoleAccess(user) {
    const currentPage = getCurrentPage();
    const userRole = await getUserRole(user.uid);
    
    // If no specific access rules for this page, allow access
    if (!ROLE_ACCESS[currentPage]) {
        console.warn(`No access rules defined for ${currentPage}, allowing access by default`);
        return true;
    }
    
    // Check if user's role has access to the current page
    return ROLE_ACCESS[currentPage].includes(userRole);
}

// Get user role from Firestore
async function getUserRole(uid) {
    try {
        const userDoc = await firebase.firestore().collection('users').doc(uid).get();
        if (userDoc.exists) {
            return userDoc.data().role || ROLES.STUDENT; // Default to student if role not set
        }
        // If user document doesn't exist, create one with default student role
        await firebase.firestore().collection('users').doc(uid).set({
            role: ROLES.STUDENT,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return ROLES.STUDENT;
    } catch (error) {
        console.error('Error getting user role:', error);
        return ROLES.STUDENT; // Default to student on error
    }
}

// Redirect user based on their role
async function redirectBasedOnRole(user) {
    try {
        const userRole = await getUserRole(user.uid);
        const defaultRoute = DEFAULT_ROUTE[userRole] || 'login.html';
        window.location.href = defaultRoute;
    } catch (error) {
        console.error('Error redirecting user:', error);
        window.location.href = 'login.html';
    }
}

// Check if current page is public
function isPublicPage() {
    const currentPage = getCurrentPage();
    return !ROLE_ACCESS[currentPage]; // Pages not in ROLE_ACCESS are considered public
}

// Initialize role-based access control
async function initializeRBAC() {
    const user = firebase.auth().currentUser;
    if (user) {
        const hasAccess = await checkRoleAccess(user);
        if (!hasAccess) {
            // Redirect to appropriate dashboard if user doesn't have access
            await redirectBasedOnRole(user);
        }
    } else if (!isPublicPage()) {
        // Redirect to login if not on a public page and not logged in
        window.location.href = 'login.html';
    }
}

// Make functions available globally
window.ROLES = ROLES;
window.checkRoleAccess = checkRoleAccess;
window.getUserRole = getUserRole;
window.initializeRBAC = initializeRBAC;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (typeof firebase !== 'undefined' && firebase.auth) {
        firebase.auth().onAuthStateChanged(async (user) => {
            if (user) {
                await initializeRBAC();
            } else if (!isPublicPage()) {
                window.location.href = 'login.html';
            }
        });
    }
});
