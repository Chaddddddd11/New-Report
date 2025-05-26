// Import Firebase services and helper functions
import { db, auth } from './config.js';
import { 
    showLoading, 
    showAlert, 
    formatTimeAgo, 
    setUserRole 
} from './admin-helpers.js';

// Global state
export let currentEditUserId = null;

// User CRUD operations for admin panel

// View user details
export async function viewUser(userId) {
    try {
        showLoading(true);
        
        // Get user data from Firestore
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            throw new Error('User not found');
        }
        
        const userData = userDoc.data();
        const authUser = await auth.getUser(userId);
        
        // Update view modal content
        document.getElementById('viewUserName').textContent = userData.displayName || 'No Name';
        document.getElementById('viewUserEmail').textContent = authUser.email || 'N/A';
        
        // Set role badge
        const roleBadge = document.getElementById('viewUserRole');
        roleBadge.className = 'badge rounded-pill ';
        
        switch(userData.role) {
            case 'admin':
                roleBadge.classList.add('bg-danger');
                document.getElementById('viewUserAccountType').textContent = 'Administrator';
                break;
            case 'instructor':
                roleBadge.classList.add('bg-primary');
                document.getElementById('viewUserAccountType').textContent = 'Instructor';
                break;
            default:
                roleBadge.classList.add('bg-success');
                document.getElementById('viewUserAccountType').textContent = 'Student';
        }
        
        // Set status
        const statusBadge = document.getElementById('viewUserStatus');
        const isActive = !userData.disabled;
        statusBadge.className = 'badge ' + (isActive ? 'bg-success' : 'bg-secondary');
        statusBadge.textContent = isActive ? 'Active' : 'Inactive';
        
        // Set timestamps
        document.getElementById('viewUserLastLogin').textContent = authUser.metadata.lastSignInTime 
            ? formatTimeAgo(new Date(authUser.metadata.lastSignInTime))
            : 'Never';
            
        document.getElementById('viewUserCreatedAt').textContent = authUser.metadata.creationTime 
            ? new Date(authUser.metadata.creationTime).toLocaleDateString()
            : 'N/A';
        
        // Store current user ID for edit button
        currentEditUserId = userId;
        
        // Show the modal
        const viewModal = new bootstrap.Modal(document.getElementById('viewUserModal'));
        viewModal.show();
        
    } catch (error) {
        console.error('Error viewing user:', error);
        showAlert('Failed to load user details. Please try again.', 'danger');
    } finally {
        showLoading(false);
    }
}

// Edit user
export async function editUser(userId) {
    try {
        showLoading(true);
        
        // Get user data from Firestore
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            throw new Error('User not found');
        }
        
        const userData = userDoc.data();
        const authUser = await auth.getUser(userId);
        
        // Populate the edit form
        document.getElementById('editUserId').value = userId;
        document.getElementById('editFullName').value = userData.displayName || '';
        document.getElementById('editEmail').value = authUser.email || '';
        document.getElementById('editRole').value = userData.role || 'student';
        document.getElementById('editActive').checked = !userData.disabled;
        
        // Store current user ID
        currentEditUserId = userId;
        
        // Show the modal
        const editModal = new bootstrap.Modal(document.getElementById('editUserModal'));
        editModal.show();
        
    } catch (error) {
        console.error('Error preparing edit user:', error);
        showAlert('Failed to prepare user for editing. Please try again.', 'danger');
    } finally {
        showLoading(false);
    }
}

// Handle add new user
export async function handleAddUser(e) {
    e.preventDefault();
    
    try {
        // Get form values
        const fullName = document.getElementById('fullName').value.trim();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const role = document.getElementById('role').value;
        
        // Validate inputs
        if (!fullName || !email || !password || !role) {
            showAlert('Please fill in all required fields.', 'warning');
            return;
        }
        
        if (password.length < 8) {
            showAlert('Password must be at least 8 characters long.', 'warning');
            return;
        }
        
        // Disable button and show loading
        const saveBtn = document.getElementById('saveUserBtn');
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Creating...';
        
        // Create user in Firebase Auth
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // Update user profile
        await user.updateProfile({
            displayName: fullName
        });
        
        // Set custom claims for role
        await setUserRole(user.uid, role);
        
        // Create user document in Firestore
        await db.collection('users').doc(user.uid).set({
            uid: user.uid,
            displayName: fullName,
            email: user.email,
            role: role,
            disabled: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Send email verification
        await user.sendEmailVerification({
            url: window.location.origin + '/login.html'
        });
        
        // Reset form and close modal
        document.getElementById('addUserForm').reset();
        const modal = bootstrap.Modal.getInstance(document.getElementById('addUserModal'));
        modal.hide();
        
        // Show success message
        showAlert('User created successfully! An email verification has been sent to the user.', 'success');
        
        // Reload users
        await loadUsers();
        
    } catch (error) {
        console.error('Error creating user:', error);
        
        let errorMessage = 'Failed to create user. ';
        
        // Handle common errors
        if (error.code === 'auth/email-already-in-use') {
            errorMessage += 'This email is already registered.';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage += 'Please enter a valid email address.';
        } else if (error.code === 'auth/weak-password') {
            errorMessage += 'Password is too weak. Please choose a stronger password.';
        } else {
            errorMessage += error.message;
        }
        
        showAlert(errorMessage, 'danger');
    } finally {
        const saveBtn = document.getElementById('saveUserBtn');
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = 'Create User';
        }
    }
}

// Handle update user
export async function handleUpdateUser(e) {
    e.preventDefault();
    
    try {
        // Get form values
        const userId = document.getElementById('editUserId').value;
        const fullName = document.getElementById('editFullName').value.trim();
        const email = document.getElementById('editEmail').value.trim();
        const role = document.getElementById('editRole').value;
        const isActive = document.getElementById('editActive').checked;
        const newPassword = document.getElementById('editPassword').value;
        
        // Validate inputs
        if (!userId || !fullName || !email || !role) {
            showAlert('Please fill in all required fields.', 'warning');
            return;
        }
        
        // Disable button and show loading
        const updateBtn = document.getElementById('updateUserBtn');
        updateBtn.disabled = true;
        updateBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Updating...';
        
        // Update user in Firebase Auth
        const user = auth.currentUser;
        const updates = [];
        
        // Update email if changed
        if (user.email !== email) {
            updates.push(auth.updateEmail(user, email));
        }
        
        // Update password if provided
        if (newPassword) {
            if (newPassword.length < 8) {
                throw new Error('Password must be at least 8 characters long.');
            }
            updates.push(auth.updatePassword(user, newPassword));
        }
        
        // Update profile
        if (user.displayName !== fullName) {
            updates.push(user.updateProfile({
                displayName: fullName
            }));
        }
        
        // Update custom claims for role
        const token = await user.getIdTokenResult(true);
        if (token.claims.role !== role) {
            updates.push(setUserRole(user.uid, role));
        }
        
        // Wait for all auth updates to complete
        await Promise.all(updates);
        
        // Update user document in Firestore
        await db.collection('users').doc(userId).update({
            displayName: fullName,
            email: email,
            role: role,
            disabled: !isActive,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('editUserModal'));
        modal.hide();
        
        // Show success message
        showAlert('User updated successfully!', 'success');
        
        // Reload users
        await loadUsers();
        
    } catch (error) {
        console.error('Error updating user:', error);
        
        let errorMessage = 'Failed to update user. ';
        
        // Handle common errors
        if (error.code === 'auth/requires-recent-login') {
            errorMessage += 'Please log in again to update your account.';
        } else if (error.code === 'auth/email-already-in-use') {
            errorMessage += 'This email is already registered.';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage += 'Please enter a valid email address.';
        } else if (error.code === 'auth/weak-password') {
            errorMessage += 'Password is too weak. Please choose a stronger password.';
        } else {
            errorMessage += error.message;
        }
        
        showAlert(errorMessage, 'danger');
    } finally {
        const updateBtn = document.getElementById('updateUserBtn');
        if (updateBtn) {
            updateBtn.disabled = false;
            updateBtn.innerHTML = 'Update User';
        }
    }
}

// Confirm delete user
export function confirmDeleteUser(userId) {
    const user = users.find(u => u.uid === userId);
    if (!user) return;
    
    // Set user info in the confirmation modal
    document.getElementById('deleteUserName').textContent = user.displayName || 'this user';
    document.getElementById('deleteUserEmail').textContent = user.email;
    
    // Store user ID for the delete action
    currentEditUserId = userId;
    
    // Show the confirmation modal
    const deleteModal = new bootstrap.Modal(document.getElementById('deleteUserModal'));
    deleteModal.show();
}

// Handle delete user
export async function handleDeleteUser() {
    const userId = currentEditUserId;
    if (!userId) return;
    
    try {
        showLoading(true);
        
        // Disable delete button
        const deleteBtn = document.getElementById('confirmDeleteBtn');
        deleteBtn.disabled = true;
        deleteBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Deleting...';
        
        // Delete user from Firebase Auth
        await auth.deleteUser(userId);
        
        // Delete user document from Firestore
        await db.collection('users').doc(userId).delete();
        
        // Close the modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('deleteUserModal'));
        modal.hide();
        
        // Show success message
        showAlert('User deleted successfully!', 'success');
        
        // Reload users
        await loadUsers();
        
    } catch (error) {
        console.error('Error deleting user:', error);
        showAlert('Failed to delete user. ' + (error.message || 'Please try again.'), 'danger');
        
        // Re-enable delete button on error
        const deleteBtn = document.getElementById('confirmDeleteBtn');
        if (deleteBtn) {
            deleteBtn.disabled = false;
            deleteBtn.innerHTML = 'Delete User';
        }
    } finally {
        showLoading(false);
    }
}
