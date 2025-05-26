const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // Download from Firebase Project Settings

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const uid = 'USER_UID_HERE'; // Replace with the user's UID

admin.auth().setCustomUserClaims(uid, { role: 'admin' })
  .then(() => {
    console.log('Successfully set admin role for user');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error setting admin role:', error);
    process.exit(1);
  });
