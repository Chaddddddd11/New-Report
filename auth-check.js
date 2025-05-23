// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDBu7-vOFmS62IaGD8-8zb6TH0a1mHYNpI",
    authDomain: "dhvsu-faculty-scheduling.firebaseapp.com",
    projectId: "dhvsu-faculty-scheduling",
    storageBucket: "dhvsu-faculty-scheduling.appspot.com",
    messagingSenderId: "1075180921702",
    appId: "1:1075180921702:web:a0320fa286c684511cdea7",
    measurementId: "G-EP4FZ04FQT"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
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

// Make logout function available globally
window.logout = logout;
