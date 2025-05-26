// Get Firebase auth instance
const auth = firebase.auth();

// List of pages that don't require authentication
const PUBLIC_PAGES = ['login.html', 'register.html', 'forgot-password.html'];

// Function to check if current page is public
function isPublicPage() {
    const currentPage = window.location.pathname.split('/').pop();
    return PUBLIC_PAGES.includes(currentPage);
}

// Function to handle successful authentication
function handleAuthenticated(user) {
    // If user is on login/register page but already logged in, redirect to home
    if (isPublicPage()) {
        window.location.href = 'home.html';
    }
    console.log('User is logged in:', user.uid);
}

// Function to handle unauthenticated user
function handleUnauthenticated() {
    // If not on a public page and not logged in, redirect to login
    if (!isPublicPage()) {
        // Store the current URL to redirect back after login
        sessionStorage.setItem('redirectAfterLogin', window.location.pathname);
        window.location.href = 'login.html';
    }
}

// Check authentication state
auth.onAuthStateChanged((user) => {
    if (user) {
        handleAuthenticated(user);
    } else {
        handleUnauthenticated();
    }
});

// Function to get current user (can be used in other scripts)
function getCurrentUser() {
    return auth.currentUser;
}

// Function to log out
function logout() {
    return auth.signOut()
        .then(() => {
            // Clear any stored data
            sessionStorage.removeItem('userData');
            // Redirect to login page
            window.location.href = 'login.html';
        })
        .catch((error) => {
            console.error('Error signing out:', error);
            alert('Error signing out. Please try again.');
        });
}

// Make functions available globally
window.logout = logout;
window.getCurrentUser = getCurrentUser;
