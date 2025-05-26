// Get Firebase auth and firestore instances
const auth = firebase.auth();
const db = firebase.firestore();

// Function to get current page
function getCurrentPage() {
    return window.location.pathname.split('/').pop() || 'index.html';
}

// Function to check if current page is public
function isPublicPage() {
    const currentPage = getCurrentPage();
    // These pages are always public
    const PUBLIC_PAGES = ['login.html', 'create.html', 'forgot.html', ''];
    return PUBLIC_PAGES.includes(currentPage) || 
           window.location.pathname.endsWith('/');
}

// Function to handle successful authentication
async function handleAuthenticated(user) {
    try {
        // Get user role
        const userRole = await getUserRole(user.uid);
        console.log(`User ${user.uid} logged in with role: ${userRole}`);
        
        // If user is on a public page, redirect to appropriate dashboard
        if (isPublicPage()) {
            const redirectUrl = sessionStorage.getItem('redirectAfterLogin') || 
                              getDefaultRoute(userRole);
            sessionStorage.removeItem('redirectAfterLogin');
            window.location.href = redirectUrl;
        }
    } catch (error) {
        console.error('Error in handleAuthenticated:', error);
        // On error, redirect to login
        window.location.href = 'login.html?error=auth_error';
    }
}

// Function to handle unauthenticated user
function handleUnauthenticated() {
    // If not on a public page and not logged in, redirect to login
    if (!isPublicPage()) {
        // Store the current URL to redirect back after login
        sessionStorage.setItem('redirectAfterLogin', window.location.pathname);
        window.location.href = 'login.html?redirected=true';
    }
}

// Get user role from Firestore
async function getUserRole(uid) {
    try {
        const userDoc = await db.collection('users').doc(uid).get();
        if (userDoc.exists) {
            return userDoc.data().role || 'student'; // Default to student if role not set
        }
        // If user document doesn't exist, create one with default student role
        await db.collection('users').doc(uid).set({
            role: 'student',
            email: auth.currentUser.email,
            displayName: auth.currentUser.displayName || '',
            photoURL: auth.currentUser.photoURL || '',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastLogin: firebase.firestore.FieldValue.serverTimestamp()
        });
        return 'student';
    } catch (error) {
        console.error('Error getting user role:', error);
        return 'student'; // Default to student on error
    }
}

// Get default route based on user role
function getDefaultRoute(role) {
    const routes = {
        'admin': 'admin-dashboard.html',
        'instructor': 'instructor-dashboard.html',
        'student': 'student-dashboard.html'
    };
    return routes[role] || 'login.html';
}

// Check authentication state
auth.onAuthStateChanged(async (user) => {
    if (user) {
        await handleAuthenticated(user);
    } else {
        handleUnauthenticated();
    }
});

// Function to get current user (can be used in other scripts)
function getCurrentUser() {
    return auth.currentUser;
}

// Function to get current user role
async function getCurrentUserRole() {
    const user = auth.currentUser;
    if (!user) return null;
    return await getUserRole(user.uid);
}

// Function to check if current user has required role
async function hasRole(requiredRoles) {
    if (!Array.isArray(requiredRoles)) {
        requiredRoles = [requiredRoles];
    }
    const userRole = await getCurrentUserRole();
    return requiredRoles.includes(userRole);
}

// Function to log out
function logout() {
    return auth.signOut()
        .then(() => {
            // Clear any stored data
            sessionStorage.removeItem('userData');
            // Redirect to login page with a parameter to show logged out message
            window.location.href = 'login.html?loggedout=true';
        })
        .catch((error) => {
            console.error('Error signing out:', error);
            alert('Error signing out. Please try again.');
        });
}

// Make functions available globally
window.logout = logout;
window.getCurrentUser = getCurrentUser;
