const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();

// Cloud Function to handle password updates
exports.updateUserPassword = functions.firestore
  .document('passwordChangeRequests/{requestId}')
  .onUpdate(async (change, context) => {
    const newValue = change.after.data();
    const previousValue = change.before.data();

    // Only proceed if status changed to 'approved'
    if (newValue.status === 'approved' && previousValue.status !== 'approved') {
      try {
        // Find the user by email
        const userRecord = await admin.auth().getUserByEmail(newValue.email);
        
        // Update the user's password
        await admin.auth().updateUser(userRecord.uid, {
          password: newValue.newPassword
        });

        console.log(`Password updated for user: ${newValue.email}`);
        
        // Update the request with completion timestamp
        await change.after.ref.update({
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedBy: context.auth ? context.auth.uid : 'system'
        });

        return { success: true };
      } catch (error) {
        console.error('Error updating password:', error);
        
        // Update the request with error information
        await change.after.ref.update({
          status: 'error',
          error: error.message,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedBy: context.auth ? context.auth.uid : 'system'
        });
        
        throw new functions.https.HttpsError('internal', 'Password update failed', error);
      }
    }
    return null;
  });
