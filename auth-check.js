// Hardcoded admin accounts (for development only)
const HARDCODED_ADMINS = [
    {
        email: 'budzchard17@gmail.com',
        password: 'admin123', // In a real app, use strong, unique passwords
        role: 'admin',
        displayName: 'Admin User 1',
        uid: 'hardcoded-admin-1'
    },
    {
        email: '2022315194@dhvsu.edu.ph',
        password: 'dhvsu123', // In a real app, use strong, unique passwords
        role: 'admin',
        displayName: 'Admin User 2',
        uid: 'hardcoded-admin-2'
    }
];

// Get Firebase auth and firestore instances
const auth = firebase.auth();
const db = firebase.firestore();

// Security configuration
const SECURITY_CONFIG = {
    // Session timeout after 30 minutes of inactivity (in milliseconds)
    SESSION_TIMEOUT: 30 * 60 * 1000,
    // Maximum number of login attempts before lockout
    MAX_LOGIN_ATTEMPTS: 5,
    // Lockout duration in milliseconds (15 minutes)
    LOCKOUT_DURATION: 15 * 60 * 1000,
    // Session key for storing login timestamp
    SESSION_TIMESTAMP_KEY: 'lastActivityTime',
    // Session key for login attempts
    LOGIN_ATTEMPTS_KEY: 'loginAttempts',
    // Session key for lockout
    LOCKOUT_UNTIL_KEY: 'lockoutUntil',
    // Allowed paths for each role
    ALLOWED_PATHS: {
        'student': ['home.html', 'index.html', 'profile.html'],
        'instructor': ['home.html', 'index.html', 'instructor-dashboard.html', 'manage-courses.html'],
        'admin': ['home.html', 'index.html', 'admin-dashboard.html', 'manage-users.html', 'system-settings.html']
    },
    // Default route for each role
    DEFAULT_ROUTES: {
        'student': 'home.html',
        'instructor': 'instructor-dashboard.html',
        'admin': 'admin-dashboard.html'
    }
};

// Track user activity to enforce session timeout
let activityTimeout;

// Reset the activity timer on user interaction
function resetActivityTimer() {
    if (!firebase.auth().currentUser) return; // Only if user is logged in
    
    clearTimeout(activityTimeout);
    sessionStorage.setItem(SECURITY_CONFIG.SESSION_TIMESTAMP_KEY, Date.now().toString());
    
    activityTimeout = setTimeout(() => {
        // Log the session timeout
        logSecurityEvent({
            type: 'session_timeout',
            userId: firebase.auth().currentUser.uid,
            email: firebase.auth().currentUser.email,
            timestamp: new Date().toISOString(),
            path: window.location.pathname
        });
        
        // Force logout when session expires
        firebase.auth().signOut().then(() => {
            sessionStorage.removeItem(SECURITY_CONFIG.SESSION_TIMESTAMP_KEY);
            window.location.href = 'login.html?session=expired';
        });
    }, SECURITY_CONFIG.SESSION_TIMEOUT);
}

// Check if current path is allowed for the user's role
function isPathAllowed(role, path) {
    // Always allow these paths
    const publicPaths = ['login.html', 'create.html', 'forgot-password.html', 'reset-password.html'];
    if (publicPaths.includes(path)) return true;
    
    // Check role-specific paths
    const allowedPaths = SECURITY_CONFIG.ALLOWED_PATHS[role] || [];
    return allowedPaths.some(allowedPath => path.endsWith(allowedPath));
}

// Get user's role from hardcoded accounts or Firebase Auth
async function getUserRole(user) {
    try {
        // Check if user is a hardcoded admin
        const hardcodedAdmin = HARDCODED_ADMINS.find(admin => admin.email === user.email);
        if (hardcodedAdmin) {
            return hardcodedAdmin.role;
        }
        
        // For non-hardcoded users, check Firebase Auth custom claims
        const idTokenResult = await user.getIdTokenResult();
        return idTokenResult.claims.role || 'student';
    } catch (error) {
        console.error('Error getting user role:', error);
        return 'student';
    }
}

// Log security events to Firestore
async function logSecurityEvent(eventData) {
    try {
        const db = firebase.firestore();
        await db.collection('security_logs').add({
            ...eventData,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            ip: await getClientIP(),
            userAgent: navigator.userAgent
        });
    } catch (error) {
        console.error('Error logging security event:', error);
    }
}

// Get client IP address
async function getClientIP() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip || 'unknown';
    } catch (error) {
        console.error('Error getting IP:', error);
        return 'unknown';
    }
}

// Handle successful login
async function handleSuccessfulLogin(user) {
    try {
        // Check if user is a hardcoded admin
        const hardcodedAdmin = HARDCODED_ADMINS.find(admin => admin.email === user.email);
        
        if (hardcodedAdmin) {
            // Set user data for hardcoded admin
            await user.updateProfile({
                displayName: hardcodedAdmin.displayName
            });
            
            // Set custom claims (if needed)
            await user.getIdToken(true); // Refresh token with latest claims
        }
        
        // Proceed with normal login flow
        const role = await getUserRole(user);
        const defaultRoute = getDefaultRoute(role);
        
        // Log successful login
        await logSecurityEvent({
            type: 'login_success',
            userId: user.uid,
            email: user.email,
            timestamp: new Date().toISOString(),
            role: role
        });
        
        // Reset login attempts on successful login
        sessionStorage.removeItem(SECURITY_CONFIG.LOGIN_ATTEMPTS_KEY);
        sessionStorage.removeItem(SECURITY_CONFIG.LOCKOUT_UNTIL_KEY);
        
        // Initialize activity tracking
        initActivityTracking();
        
        // Redirect if on login/signup page
        if (currentPath === 'login.html' || currentPath === 'create.html') {
            window.location.href = SECURITY_CONFIG.DEFAULT_ROUTES[role] || 'home.html';
        } else if (!isPathAllowed(role, currentPath)) {
            // Redirect to default route if current path is not allowed
            window.location.href = SECURITY_CONFIG.DEFAULT_ROUTES[role] || 'home.html';
        }
    } catch (error) {
        console.error('Error handling successful login:', error);
    }
}

// Handle failed login
async function handleFailedLogin(email) {
    try {
        // Get current number of attempts
        let attempts = parseInt(sessionStorage.getItem(SECURITY_CONFIG.LOGIN_ATTEMPTS_KEY) || '0');
        attempts++;
        
        // Update attempts counter
        sessionStorage.setItem(SECURITY_CONFIG.LOGIN_ATTEMPTS_KEY, attempts.toString());
        
        // Check if we should lock the account
        if (attempts >= SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS) {
            const lockoutTime = Date.now() + SECURITY_CONFIG.LOCKOUT_DURATION;
            sessionStorage.setItem(SECURITY_CONFIG.LOCKOUT_UNTIL_KEY, lockoutTime.toString());
            
            // Log the lockout event
            await logSecurityEvent({
                type: 'account_lockout',
                email: email,
                timestamp: new Date().toISOString(),
                details: {
                    attempts: attempts,
                    lockoutDuration: SECURITY_CONFIG.LOCKOUT_DURATION
                }
            });
            
            throw new Error(`Too many failed attempts. Account locked for ${Math.ceil(SECURITY_CONFIG.LOCKOUT_DURATION / 60000)} minutes.`);
        }
        
        // Log the failed attempt
        await logSecurityEvent({
            type: 'login_failed',
            email: email,
            timestamp: new Date().toISOString(),
            details: {
                attempts: attempts,
                remainingAttempts: SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS - attempts
            }
        });
        
        const remainingAttempts = SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS - attempts;
        throw new Error(`Invalid email or password. ${remainingAttempts} attempt${remainingAttempts !== 1 ? 's' : ''} remaining.`);
    } catch (error) {
        console.error('Error handling failed login:', error);
        throw error; // Re-throw to be handled by the caller
    }
}

// Initialize authentication state listener
function initAuthStateListener() {
    firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
            // User is signed in
            console.log('User is signed in:', user.email);
            
            try {
                await handleSuccessfulLogin(user);
            } catch (error) {
                console.error('Error in auth state change:', error);
                // Force logout if there's an error
                await firebase.auth().signOut();
                window.location.href = 'login.html?error=auth_error';
            }
        } else {
            // User is signed out
            console.log('User is signed out');
            
            // Clear any existing timeouts
            clearTimeout(activityTimeout);
            
            // Get current path
            const currentPath = window.location.pathname.split('/').pop() || 'index.html';
            const publicPaths = ['login.html', 'create.html', 'forgot-password.html', 'reset-password.html'];
            
            // Redirect to login if not on a public page
            if (!publicPaths.includes(currentPath) && currentPath !== 'index.html') {
                window.location.href = `login.html?redirect=${encodeURIComponent(currentPath)}`;
            }
        }
    });
}

// Initialize the application
function initApp() {
    // Initialize auth state listener
    initAuthStateListener();
    
    // Set up logout button if it exists
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            
            try {
                // Log the logout event
                const user = firebase.auth().currentUser;
                if (user) {
                    await logSecurityEvent({
                        type: 'logout',
                        userId: user.uid,
                        email: user.email,
                        timestamp: new Date().toISOString()
                    });
                }
                
                // Sign out
                await firebase.auth().signOut();
                window.location.href = 'login.html?logged_out=true';
            } catch (error) {
                console.error('Error during logout:', error);
                window.location.href = 'login.html?error=logout_failed';
            }
        });
    }
}

// Start the application when the page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

// Initialize activity tracking
function initActivityTracking() {
    // Set initial timestamp
    if (!sessionStorage.getItem(SECURITY_CONFIG.SESSION_TIMESTAMP_KEY)) {
        sessionStorage.setItem(SECURITY_CONFIG.SESSION_TIMESTAMP_KEY, Date.now().toString());
    }
    
    // Add event listeners for user activity
    ['mousemove', 'keydown', 'click', 'scroll'].forEach(event => {
        document.addEventListener(event, resetActivityTimer, { passive: true });
    });
    
    resetActivityTimer();
}

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
        // Reset login attempts on successful login
        sessionStorage.removeItem(SECURITY_CONFIG.LOGIN_ATTEMPTS_KEY);
        sessionStorage.removeItem(SECURITY_CONFIG.LOCKOUT_UNTIL_KEY);
        
        // Get user role with additional security checks
        const userRole = await getUserRole(user.uid);
        
        // Log the login event
        await logSecurityEvent(user.uid, 'login_success', {
            ip: await getClientIP(),
            userAgent: navigator.userAgent
        });
        
        console.log(`User ${user.email} logged in with role: ${userRole}`);
        
        // Initialize session tracking
        initActivityTracking();
        
        // If user is on a public page, redirect to appropriate dashboard
        if (isPublicPage()) {
            const redirectUrl = sessionStorage.getItem('redirectAfterLogin') || 
                              getDefaultRoute(userRole);
            sessionStorage.removeItem('redirectAfterLogin');
            
            // Add a small delay to ensure all session data is saved
            setTimeout(() => {
                window.location.href = redirectUrl;
            }, 100);
        }
    } catch (error) {
        console.error('Error in handleAuthenticated:', error);
        // Log the error
        await logSecurityEvent(user?.uid || 'unknown', 'login_error', {
            error: error.message,
            ip: await getClientIP()
        });
        
        // On error, redirect to login with generic error
        window.location.href = 'login.html?error=auth_error';
    }
}

// Function to handle failed login attempts
async function handleFailedLogin(email) {
    try {
        // Get or initialize login attempts
        let attempts = parseInt(sessionStorage.getItem(SECURITY_CONFIG.LOGIN_ATTEMPTS_KEY) || '0');
        attempts++;
        
        // Check if account is locked
        const lockoutUntil = parseInt(sessionStorage.getItem(SECURITY_CONFIG.LOCKOUT_UNTIL_KEY) || '0');
        if (lockoutUntil > Date.now()) {
            const remainingTime = Math.ceil((lockoutUntil - Date.now()) / 60000);
            throw new Error(`Account temporarily locked. Try again in ${remainingTime} minutes.`);
        }
        
        // Update login attempts
        sessionStorage.setItem(SECURITY_CONFIG.LOGIN_ATTEMPTS_KEY, attempts.toString());
        
        // Log the failed attempt
        await logSecurityEvent(email, 'login_failed', {
            attempt: attempts,
            ip: await getClientIP(),
            userAgent: navigator.userAgent
        });
        
        // Check if we should lock the account
        if (attempts >= SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS) {
            const lockoutTime = Date.now() + SECURITY_CONFIG.LOCKOUT_DURATION;
            sessionStorage.setItem(SECURITY_CONFIG.LOCKOUT_UNTIL_KEY, lockoutTime.toString());
            
            await logSecurityEvent(email, 'account_locked', {
                until: new Date(lockoutTime).toISOString(),
                ip: await getClientIP()
            });
            
            throw new Error(`Too many failed attempts. Account locked for ${SECURITY_CONFIG.LOCKOUT_DURATION / 60000} minutes.`);
        }
        
        const remainingAttempts = SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS - attempts;
        throw new Error(`Invalid credentials. ${remainingAttempts} attempts remaining.`);
        
    } catch (error) {
        console.error('Login failed:', error);
        throw error; // Re-throw to be handled by the caller
    }
}

// Log security events to Firestore
async function logSecurityEvent(userId, eventType, data = {}) {
    try {
        await db.collection('security_logs').add({
            userId,
            eventType,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            ...data
        });
    } catch (error) {
        console.error('Error logging security event:', error);
        // Don't throw to avoid blocking the main flow
    }
}

// Get client IP (note: this requires a server-side component to be fully accurate)
async function getClientIP() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip || 'unknown';
    } catch (error) {
        console.error('Error getting IP:', error);
        return 'unknown';
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
        'instructor': 'Instructor.html',  // Redirect instructors to Instructor.html
        'student': 'home.html'  // Redirect students to home.html
    };
    return routes[role] || 'login.html';
}

// Check authentication state with enhanced security
auth.onAuthStateChanged(async (user) => {
    try {
        // Check for session timeout
        const lastActivity = sessionStorage.getItem(SECURITY_CONFIG.SESSION_TIMESTAMP_KEY);
        if (lastActivity && (Date.now() - parseInt(lastActivity)) > SECURITY_CONFIG.SESSION_TIMEOUT) {
            // Session expired
            if (user) {
                await logSecurityEvent(user.uid, 'session_expired', {
                    ip: await getClientIP()
                });
                await auth.signOut();
            }
            window.location.href = 'login.html?session=expired';
            return;
        }
        
        if (user) {
            // Verify user's token to ensure it's valid
            const idTokenResult = await user.getIdTokenResult();
            const authTime = new Date(idTokenResult.authTime * 1000);
            const sessionDuration = Date.now() - authTime.getTime();
            
            // If token is older than session timeout, force re-authentication
            if (sessionDuration > SECURITY_CONFIG.SESSION_TIMEOUT) {
                await logSecurityEvent(user.uid, 'session_timeout', {
                    ip: await getClientIP(),
                    sessionDuration
                });
                await auth.signOut();
                window.location.href = 'login.html?session=expired';
                return;
            }
            
            await handleAuthenticated(user);
        } else {
            handleUnauthenticated();
        }
    } catch (error) {
        console.error('Auth state error:', error);
        // If there's an error, redirect to login
        window.location.href = 'login.html?error=auth_check_failed';
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
async function logout() {
    const user = auth.currentUser;
    const userId = user?.uid;
    
    try {
        // Log the logout event
        if (userId) {
            await logSecurityEvent(userId, 'logout', {
                ip: await getClientIP()
            });
        }
        
        // Sign out from Firebase
        await auth.signOut();
        
        // Clear all session data
        sessionStorage.clear();
        clearTimeout(activityTimeout);
        
        // Remove all event listeners
        ['mousemove', 'keydown', 'click', 'scroll'].forEach(event => {
            document.removeEventListener(event, resetActivityTimer);
        });
        
        // Redirect to login page with success message
        window.location.href = 'login.html?logout=success';
        
    } catch (error) {
        console.error('Error during logout:', error);
        
        // Log the error
        if (userId) {
            await logSecurityEvent(userId, 'logout_error', {
                error: error.message,
                ip: await getClientIP()
            });
        }
        
        // Even if there's an error, redirect to login page
        window.location.href = 'login.html';
    }
}

// Make functions available globally
window.logout = logout;
window.getCurrentUser = getCurrentUser;
