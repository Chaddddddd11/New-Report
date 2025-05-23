// Get Firebase auth instance
const auth = firebase.auth();

// Check authentication state
auth.onAuthStateChanged((user) => {
    if (!user) {
        // If user is not logged in, redirect to login page
        // Store the current URL to redirect back after login
        sessionStorage.setItem('redirectAfterLogin', window.location.pathname);
        window.location.href = 'login.html';
    } else {
        // User is logged in, you can access user info if needed
        console.log('User is logged in:', user.uid);
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
