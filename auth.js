// auth.js - Authentication helper functions

// Check if user is authenticated, if not redirect to login
function checkAuth() {
    return new Promise((resolve, reject) => {
        const user = firebase.auth().currentUser;
        if (user) {
            // User is signed in, resolve with user data
            resolve(user);
        } else {
            // No user is signed in, redirect to login
            window.location.href = 'login.html';
            reject(new Error('User not authenticated'));
        }
    });
}

// Get current user data with Firestore data
function getCurrentUser() {
    return new Promise((resolve, reject) => {
        const user = firebase.auth().currentUser;
        if (user) {
            // Get additional user data from Firestore
            firebase.firestore().collection('users').doc(user.uid).get()
                .then((doc) => {
                    if (doc.exists) {
                        resolve({ ...user, ...doc.data() });
                    } else {
                        resolve(user);
                    }
                })
                .catch((error) => {
                    console.error('Error getting user data:', error);
                    resolve(user);
                });
        } else {
            reject(new Error('No user logged in'));
        }
    });
}

// Sign out user
function signOut() {
    return firebase.auth().signOut()
        .then(() => {
            // Clear any stored user data
            sessionStorage.removeItem('user');
            localStorage.removeItem('user');
            // Redirect to login page
            window.location.href = 'login.html';
        })
        .catch((error) => {
            console.error('Error signing out:', error);
        });
}

// Export the functions
window.Auth = {
    checkAuth,
    getCurrentUser,
    signOut
};
