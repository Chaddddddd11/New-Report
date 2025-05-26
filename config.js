// Firebase configuration - Replace with your actual Firebase config
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = firebase.auth();
const db = firebase.firestore();

// Security rules
const SECURITY_CONFIG = {
    MAX_LOGIN_ATTEMPTS: 5,
    LOCKOUT_TIME: 15 * 60 * 1000, // 15 minutes in milliseconds
    SESSION_TIMEOUT: 30 * 60 * 1000 // 30 minutes in milliseconds
};

// Export the initialized services and config
export { 
    auth, 
    db, 
    SECURITY_CONFIG, 
    firebase // Export firebase instance if needed elsewhere
};

// Make firebase available globally for HTML event handlers
window.firebase = firebase;
