const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();

// Callable function to update user password
exports.updateUserPassword = functions.https.onCall(async (data, context) => {
    // Verify user is authenticated and admin
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'Only authenticated users can update passwords'
        );
    }

    const { email, newPassword } = data;

    try {
        // Get the user by email
        const userRecord = await admin.auth().getUserByEmail(email);
        
        // Update the user's password
        await admin.auth().updateUser(userRecord.uid, {
            password: newPassword
        });

        console.log(`Password updated for user: ${email}`);
        return { success: true };
    } catch (error) {
        console.error('Error updating password:', error);
        throw new functions.https.HttpsError(
            'internal',
            'Failed to update password',
            error.message
        );
    }
});

// Trigger to update request status when password is changed
exports.onPasswordChangeRequestUpdate = functions.firestore
    .document('passwordChangeRequests/{requestId}')
    .onUpdate(async (change, context) => {
        const newValue = change.after.data();
        const previousValue = change.before.data();

        // Only proceed if status changed to 'approved'
        if (newValue.status === 'approved' && previousValue.status !== 'approved') {
            try {
                await change.after.ref.update({
                    completedAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedBy: context.auth ? context.auth.uid : 'system'
                });
                console.log(`Request ${context.params.requestId} marked as completed`);
            } catch (error) {
                console.error('Error updating request status:', error);
                throw error;
            }
        }
        return null;
    });
