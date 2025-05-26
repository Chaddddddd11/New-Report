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
    'create.html': [ROLES.ADMIN, ROLES.INSTRUCTOR, ROLES.STUDENT],
    'forgot.html': [ROLES.ADMIN, ROLES.INSTRUCTOR, ROLES.STUDENT],
    // Admin only routes
    'admin-dashboard.html': [ROLES.ADMIN],
    'manage-users.html': [ROLES.ADMIN],
    // Instructor routes
    'instructor-dashboard.html': [ROLES.ADMIN, ROLES.INSTRUCTOR],
    'my-schedule.html': [ROLES.ADMIN, ROLES.INSTRUCTOR],
    // Student routes
    'student-dashboard.html': [ROLES.ADMIN, ROLES.STUDENT],
    'view-schedule.html': [ROLES.ADMIN, ROLES.STUDENT]
};

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
