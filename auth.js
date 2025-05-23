// auth.js - Authentication helper functions

// Custom error class for authentication errors
class AuthError extends Error {
    constructor(message, code = 'AUTH_ERROR') {
        super(message);
        this.name = 'AuthError';
        this.code = code;
    }
}

// Track auth state to prevent multiple simultaneous checks
let authCheckInProgress = false;
let authInitialized = false;

// Initialize Firebase authentication
function initializeAuth() {
    if (authInitialized) return Promise.resolve();
    
    if (!firebase.apps.length) {
        throw new AuthError('Firebase not initialized', 'FIREBASE_NOT_INITIALIZED');
    }
    
    return firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)
        .then(() => {
            authInitialized = true;
            logAuthEvent('auth_initialized');
        })
        .catch(error => {
            logAuthEvent('auth_initialization_failed', { error: error.message });
            throw new AuthError('Failed to initialize authentication', 'AUTH_INIT_FAILED');
        });
}

// Check if user is authenticated with proper error handling
async function checkAuth() {
    if (authCheckInProgress) {
        return new Promise((resolve) => {
            const checkAuthState = () => {
                if (!authCheckInProgress) {
                    checkAuth().then(resolve);
                } else {
                    setTimeout(checkAuthState, 100);
                }
            };
            checkAuthState();
        });
    }

    authCheckInProgress = true;
    
    try {
        await initializeAuth();
        
        // Check for stored user data first
        const storedUser = getStoredUser();
        const currentUser = firebase.auth().currentUser;
        
        // If we have a stored user but no current user, try to restore session
        if (storedUser && !currentUser) {
            logAuthEvent('session_restore_attempt', { userId: storedUser.uid });
            throw new AuthError('Session expired', 'SESSION_EXPIRED');
        }
        
        // If no user is authenticated, redirect to login
        if (!currentUser) {
            logAuthEvent('no_authenticated_user');
            redirectToLogin();
            throw new AuthError('No authenticated user', 'NOT_AUTHENTICATED');
        }
        
        // Verify the user's ID token is still valid
        const idTokenResult = await currentUser.getIdTokenResult(true);
        if (idTokenResult.token.exp * 1000 < Date.now()) {
            logAuthEvent('token_expired', { userId: currentUser.uid });
            await signOut();
            throw new AuthError('Session expired', 'TOKEN_EXPIRED');
        }
        
        // Get additional user data from Firestore
        const userData = await fetchUserData(currentUser.uid);
        const user = { ...currentUser, ...userData };
        
        // Update stored user data
        storeUserData(user);
        
        logAuthEvent('authentication_success', { userId: user.uid });
        return user;
        
    } catch (error) {
        logAuthEvent('authentication_failed', { 
            error: error.message,
            code: error.code || 'UNKNOWN_ERROR'
        });
        
        if (error.code === 'auth/network-request-failed') {
            throw new AuthError('Network error. Please check your connection.', 'NETWORK_ERROR');
        }
        
        throw error; // Re-throw to be handled by the caller
    } finally {
        authCheckInProgress = false;
    }
}

// Get current user data with Firestore data
async function getCurrentUser() {
    try {
        const user = firebase.auth().currentUser;
        if (!user) {
            throw new AuthError('No user is currently signed in', 'NO_CURRENT_USER');
        }
        
        // Get fresh data from Firestore
        const userData = await fetchUserData(user.uid);
        return { ...user, ...userData };
        
    } catch (error) {
        logAuthEvent('get_user_data_failed', { error: error.message });
        throw error;
    }
}

// Helper function to fetch user data from Firestore
async function fetchUserData(uid) {
    try {
        const doc = await firebase.firestore().collection('users').doc(uid).get();
        if (!doc.exists) {
            logAuthEvent('user_data_not_found', { userId: uid });
            return {};
        }
        return doc.data();
    } catch (error) {
        logAuthEvent('fetch_user_data_failed', { 
            userId: uid, 
            error: error.message 
        });
        return {}; // Return empty object to prevent app from breaking
    }
}

// Store user data in session and local storage
function storeUserData(user) {
    if (!user) return;
    
    const userData = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || user.email.split('@')[0],
        role: user.role || 'user',
        lastLogin: new Date().toISOString()
    };
    
    try {
        sessionStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('user', JSON.stringify(userData));
    } catch (error) {
        logAuthEvent('storage_error', { error: error.message });
        // Continue even if storage fails
    }
}

// Get stored user data
function getStoredUser() {
    try {
        const storedUser = sessionStorage.getItem('user') || localStorage.getItem('user');
        return storedUser ? JSON.parse(storedUser) : null;
    } catch (error) {
        logAuthEvent('get_stored_user_failed', { error: error.message });
        return null;
    }
}

// Clear stored user data
function clearStoredUser() {
    try {
        sessionStorage.removeItem('user');
        localStorage.removeItem('user');
    } catch (error) {
        logAuthEvent('clear_stored_user_failed', { error: error.message });
    }
}

// Redirect to login page
function redirectToLogin() {
    if (!window.location.href.includes('login.html')) {
        window.location.replace('login.html');
    }
}

// Log authentication events
function logAuthEvent(event, details = {}) {
    const timestamp = new Date().toISOString();
    console.log(`[Auth][${timestamp}] ${event}`, details);
    
    // Could be extended to send events to analytics service
    // Example: analytics.logEvent(event, { timestamp, ...details });
}

// Sign out user
async function signOut() {
    try {
        await firebase.auth().signOut();
        clearStoredUser();
        logAuthEvent('user_signed_out');
    } catch (error) {
        logAuthEvent('sign_out_failed', { error: error.message });
        throw new AuthError('Failed to sign out', 'SIGN_OUT_FAILED');
    }
}

// Set up auth state change listener
function onAuthStateChanged(callback) {
    return firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
            try {
                const userData = await fetchUserData(user.uid);
                callback({ ...user, ...userData });
            } catch (error) {
                console.error('Error in auth state change:', error);
                callback(null);
            }
        } else {
            callback(null);
        }
    });
}

// Export the authentication API
const Auth = {
    initializeAuth,
    checkAuth,
    getCurrentUser,
    signOut,
    onAuthStateChanged,
    AuthError // Export the error class for type checking
};

// Auto-initialize when imported
initializeAuth().catch(error => {
    console.error('Failed to initialize auth:', error);
});

// Export the Auth object
try {
    window.Auth = Auth;
} catch (error) {
    // Not running in a browser environment
    console.log('Running in non-browser environment:', error.message);
}

// Export the authentication API
export default Auth;
