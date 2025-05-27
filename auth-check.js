// Firebase configuration for room-management-system
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyDeqxzp_-kKjM3hPr6CLGfTn38e4swSKbo",
    authDomain: "room-management-system-8e899.firebaseapp.com",
    projectId: "room-management-system-8e899",
    storageBucket: "room-management-system-8e899.firebasestorage.app",
    messagingSenderId: "667821278853",
    appId: "1:667821278853:web:a3a80c985073772670cbec"
};

// Global flag to track if Firestore is available
let isFirestoreEnabled = false;

// Mock Firestore functions for offline mode
const mockFirestore = {
    collection: () => ({
        doc: () => ({
            get: () => Promise.resolve({ exists: false, data: () => null }),
            set: () => Promise.resolve(),
            update: () => Promise.resolve(),
            delete: () => Promise.resolve(),
            collection: () => mockFirestore.collection(),
            onSnapshot: () => () => {}
        }),
        where: () => ({
            get: () => Promise.resolve({ empty: true, docs: [] }),
            onSnapshot: () => () => {}
        }),
        get: () => Promise.resolve({ empty: true, docs: [] }),
        onSnapshot: () => () => {}
    })
};

// Initialize Firebase services if not already done
if (typeof window !== 'undefined' && (typeof window.auth === 'undefined' || typeof window.db === 'undefined')) {
    try {
        // Initialize Firebase if not already initialized
        if (!firebase.apps.length) {
            firebase.initializeApp(FIREBASE_CONFIG);
        }
        
        // Set up authentication
        window.auth = firebase.auth();
        
        // Try to initialize Firestore if it's available
        if (typeof firebase.firestore === 'function') {
            try {
                window.db = firebase.firestore();
                isFirestoreEnabled = true;
                
                // Set Firestore settings
                const settings = { cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED };
                window.db.settings(settings);
                
                // Enable offline persistence (but don't wait for it)
                window.db.enablePersistence({ experimentalForceOwningTab: true })
                    .then(() => console.log('Firestore persistence enabled'))
                    .catch(err => {
                        if (err.code === 'failed-precondition') {
                            console.warn('Offline persistence can only be enabled in one tab at a time.');
                        } else if (err.code === 'unimplemented') {
                            console.warn('The current browser does not support offline persistence.');
                        } else {
                            console.warn('Error enabling offline persistence:', err);
                        }
                        isFirestoreEnabled = false;
                    });
                    
                console.log('Firestore initialized with offline persistence');
            } catch (firestoreError) {
                console.warn('Firestore initialization failed, running in offline mode:', firestoreError.message);
                isFirestoreEnabled = false;
                window.db = mockFirestore;
            }
        } else {
            console.warn('Firestore is not available, running in offline mode');
            isFirestoreEnabled = false;
            window.db = mockFirestore;
        }
    } catch (error) {
        console.error('Firebase initialization error:', error);
        
        // Provide mock auth and db objects for offline mode
        window.auth = window.auth || {
            currentUser: null,
            onAuthStateChanged: (callback) => {
                // Mock auth state change for offline mode
                callback(null);
                return () => {};
            },
            signOut: async () => {
                window.location.href = 'login.html';
            }
        };
        
        window.db = window.db || mockFirestore;
        
        // Show error to user if running in browser
        if (typeof document !== 'undefined') {
            const errorDiv = document.createElement('div');
            errorDiv.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; background: #f8d7da; color: #721c24; padding: 15px; text-align: center; z-index: 9999;';
            errorDiv.textContent = 'Error initializing the application. Some features may not be available.';
            document.body.prepend(errorDiv);
        }
    }
}

// Collection names
const COLLECTIONS = {
    ADMIN: 'admin',
    STUDENTS: 'Students',
    INSTRUCTORS: 'Instructor'
};

// Role types
const ROLES = {
    ADMIN: 'admin',
    INSTRUCTOR: 'instructor',
    STUDENT: 'student'
};

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
        'student': ['home.html', 'index.html'],
        'instructor': ['home.html', 'index.html', 'Room.html', 'Instructors.html', 'bulk-upload-final.html'],
        'admin': ['home.html', 'index.html', 'admin-panel.html', '*.html']  // Admin can access all pages
    },
    // Default route for each role after login
    DEFAULT_ROUTES: {
        'student': 'home.html',
        'instructor': 'home.html',
        'admin': 'admin-panel.html'
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

// Get user's role and data (simplified version without Firestore)
async function getUserRoleAndData(user) {
    try {
        // Default role is student, but make admin@example.com an admin
        const isAdmin = user.email === 'admin@example.com' || user.email.endsWith('@dhvsu.edu.ph');
        const role = isAdmin ? ROLES.ADMIN : ROLES.STUDENT;
        
        // Create basic user data without Firestore
        const userData = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || user.email.split('@')[0],
            emailVerified: true,
            role: role,
            status: 'active',
            lastLogin: new Date().toISOString(),
            canManageSchedule: isAdmin,
            canManageSystem: isAdmin,
            canManageUsers: isAdmin
        };

        // Store user data in session storage
        sessionStorage.setItem('user', JSON.stringify(userData));
        
        // Set custom claims (non-blocking)
        try {
            await setCustomUserClaims(user.uid, {
                role: role,
                canManageSchedule: isAdmin,
                canManageSystem: isAdmin,
                canManageUsers: isAdmin
            });
        } catch (error) {
            console.warn('Could not set custom claims:', error.message || error);
        }

        return {
            role: role,
            userData: userData
        };
    } catch (error) {
        console.error('Error getting user role and data:', error);
        throw error;
    }
}

// Set custom claims for the user (simplified version without Cloud Functions)
async function setCustomUserClaims(uid, role) {
    try {
        // Skip setting custom claims if Firebase Functions is not available
        if (!firebase.functions) {
            console.log('Firebase Functions not available, skipping custom claims');
            return;
        }
        
        // Try to use Cloud Function if available
        const setClaims = firebase.functions().httpsCallable('setCustomClaims');
        await setClaims({ uid, role });
    } catch (error) {
        console.warn('Could not set custom claims (non-critical):', error.message);
        // Continue without custom claims
    }
}

// Log security events to Firestore (fallback to console if Firestore is not available)
async function logSecurityEvent(eventData) {
    // Always log to console for debugging
    console.log('Security Event:', eventData);
    
    // Only try to log to Firestore if it's available
    if (isFirestoreAvailable()) {
        try {
            const db = firebase.firestore();
            await db.collection('security_logs').add({
                ...eventData,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                ip: await getClientIP(),
                userAgent: navigator.userAgent
            });
        } catch (error) {
            console.warn('Could not log to Firestore (running in offline mode):', error.message);
        }
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
        // Reset login attempts on successful login
        sessionStorage.removeItem(SECURITY_CONFIG.LOGIN_ATTEMPTS_KEY);
        sessionStorage.removeItem(SECURITY_CONFIG.LOCKOUT_UNTIL_KEY);

        // Get user's role and data
        const { role, userData } = await getUserRoleAndData(user);
        
        if (!role) {
            console.error('No role found for user:', user.uid);
            await auth.signOut();
            window.location.href = 'login.html?error=no_role';
            return;
        }

        // Check if user is active
        if (userData.status && userData.status !== 'active') {
            await auth.signOut();
            if (userData.status === 'pending') {
                window.location.href = 'login.html?error=account_pending';
            } else if (userData.status === 'suspended') {
                window.location.href = 'login.html?error=account_suspended';
            } else {
                window.location.href = 'login.html?error=account_inactive';
            }
            return;
        }

        // Check if email is verified (except for admins who might be verified by default)
        if (!user.emailVerified && role !== ROLES.ADMIN) {
            await auth.signOut();
            window.location.href = 'login.html?error=email_not_verified';
            return;
        }

        // Get user data from sessionStorage (set in getUserRoleAndData)
        const storedUserData = JSON.parse(sessionStorage.getItem('user') || '{}');
        
        // Update last login time if Firestore is available
        if (isFirestoreAvailable()) {
            try {
                const lastLogin = new Date().toISOString();
                let collectionName = COLLECTIONS.STUDENTS;
                if (role === ROLES.ADMIN) collectionName = COLLECTIONS.ADMIN;
                else if (role === ROLES.INSTRUCTOR) collectionName = COLLECTIONS.INSTRUCTORS;
                
                await db.collection(collectionName).doc(user.uid).update({
                    lastLogin: lastLogin,
                    emailVerified: user.emailVerified || true
                });
            } catch (error) {
                console.warn('Could not update last login time:', error.message);
                // Continue with the login process even if this fails
            }
        }
        
        // Initialize activity tracking
        initActivityTracking();
        
        // Check if we have a redirect URL in session storage (from protected route)
        const redirectUrl = sessionStorage.getItem('redirectAfterLogin');
        if (redirectUrl) {
            sessionStorage.removeItem('redirectAfterLogin');
            window.location.href = redirectUrl;
            return;
        }

        // Otherwise, redirect based on role
        const redirectPath = getRedirectPath(storedUserData.role || ROLES.STUDENT);
        if (window.location.pathname !== redirectPath) {
            window.location.href = redirectPath;
        }
    } catch (error) {
        console.error('Error in handleSuccessfulLogin:', error);
        
        // Log the error
        await logSecurityEvent({
            userId: user?.uid || 'unknown',
            eventType: 'login_error',
            ipAddress: await getClientIP(),
            userAgent: navigator.userAgent,
            metadata: {
                error: error.message,
                code: error.code
            }
        });
        
        // If there's an error, log out and redirect to login with error
        try {
            await auth.signOut();
        } catch (signOutError) {
            console.error('Error during sign out:', signOutError);
        }
        window.location.href = `login.html?error=login_failed&message=${encodeURIComponent(error.message)}`;
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
        console.log('Auth state changed. User:', user ? user.email : 'signed out');
        
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
            const publicPaths = ['login.html', 'create.html', 'forgot.html', 'index.html', 'forgot-password.html', 'reset-password.html'];
            
            console.log('Current path:', currentPath);
            console.log('Public paths:', publicPaths);
            
            // Redirect to login if not on a public page
            if (!publicPaths.includes(currentPath) && currentPath !== 'home.html') {
                console.log('Redirecting to login page');
                window.location.href = `login.html?redirect=${encodeURIComponent(currentPath)}`;
            } else {
                console.log('Allowing access to:', currentPath);
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

// Register new user
async function registerUser(userData) {
    try {
        // 1. Create auth user
        const { user } = await auth.createUserWithEmailAndPassword(
            userData.email, 
            userData.password
        );

        // 2. Send email verification
        await user.sendEmailVerification({
            url: window.location.origin + '/login?verified=true'
        });

        // 3. Update user profile with display name
        if (userData.displayName) {
            await user.updateProfile({
                displayName: userData.displayName
            });
        }


        // 4. Determine collection based on role (default to student)
        const role = userData.role || ROLES.STUDENT;
        const userDoc = {
            uid: user.uid,
            email: userData.email,
            displayName: userData.displayName || userData.email.split('@')[0],
            emailVerified: false,
            role: role,
            status: 'pending', // Requires email verification
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastLogin: null,
            // Include any additional user data
            ...(role === ROLES.INSTRUCTOR && { 
                department: userData.department || '',
                title: userData.title || ''
            }),
            ...(role === ROLES.STUDENT && {
                idNumber: userData.idNumber || '',
                course: userData.course || '',
                yearLevel: userData.yearLevel || '',
                section: userData.section || ''
            })
        };

        // 5. Add to appropriate collection
        let collectionName;
        switch(role) {
            case ROLES.ADMIN:
                collectionName = COLLECTIONS.ADMIN;
                userDoc.status = 'active'; // Admins are active immediately
                break;
            case ROLES.INSTRUCTOR:
                collectionName = COLLECTIONS.INSTRUCTORS;
                userDoc.status = 'pending'; // Instructors need approval
                break;
            default:
                collectionName = COLLECTIONS.STUDENTS;
                userDoc.status = 'active'; // Students are active immediately
        }

        // 6. Save user data to Firestore
        await db.collection(collectionName).doc(user.uid).set(userDoc);

        // 7. Set custom claims for role-based access
        await setCustomUserClaims(user.uid, role);

        // 8. Log the registration event
        await logSecurityEvent({
            userId: user.uid,
            eventType: 'user_registered',
            ipAddress: await getClientIP(),
            userAgent: navigator.userAgent,
            metadata: {
                role: role,
                email: userData.email
            }
        });

        return { 
            success: true, 
            user: {
                uid: user.uid,
                email: user.email,
                emailVerified: user.emailVerified,
                displayName: user.displayName || '',
                role: role
            },
            requiresVerification: true
        };
    } catch (error) {
        console.error('Registration error:', error);
        return { 
            success: false, 
            error: error.message,
            code: error.code
        };
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
        'admin': 'admin-panel.html',  // Redirect admins to admin-panel.html
        'instructor': 'Instructor.html',  // Redirect instructors to Instructor.html
        'student': 'home.html'  // Redirect students to home.html
    };
    return routes[role] || 'login.html';
}

// Get redirect path based on user role and current path
function getRedirectPath(role) {
    // If user is trying to access login/register but already authenticated
    const currentPath = window.location.pathname;
    const authPages = ['/login.html', '/register.html', '/index.html'];
    
    if (authPages.some(page => currentPath.endsWith(page))) {
        return getDefaultRoute(role);
    }
    
    // Check if current path is allowed for user role
    if (!isPathAllowed(role, currentPath)) {
        return getDefaultRoute(role);
    }
    
    // Stay on current page if allowed
    return currentPath;
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
