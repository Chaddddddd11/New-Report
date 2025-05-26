// Import Firebase services and helper functions
import { db, auth } from './config.js';
import { formatTimeAgo, showLoading, showAlert } from './admin-helpers.js';

// User management functions for admin panel

// Global state
let users = [];

// Load users from Firestore
export async function loadUsers() {
    try {
        showLoading(true);
        
        // Get all users from Firestore
        const usersSnapshot = await db.collection('users').get();
        users = [];
        
        // Process each user document
        const userPromises = usersSnapshot.docs.map(async (doc) => {
            const userData = doc.data();
            const authUser = await auth.getUser(userData.uid);
            
            return {
                id: doc.id,
                uid: userData.uid,
                email: authUser.email,
                displayName: userData.displayName || authUser.displayName || 'No Name',
                role: userData.role || 'student',
                isActive: !userData.disabled,
                lastSignInTime: authUser.metadata.lastSignInTime,
                creationTime: authUser.metadata.creationTime,
                emailVerified: authUser.emailVerified,
                photoURL: authUser.photoURL
            };
        });
        
        // Wait for all user data to be processed
        users = await Promise.all(userPromises);
        
        // Update UI with users
        renderUsers(users);
        updateStats(users);
        
    } catch (error) {
        console.error('Error loading users:', error);
        showAlert('Failed to load users. Please try again.', 'danger');
    } finally {
        showLoading(false);
    }
}

// Render users in the table
export function renderUsers(usersToRender) {
    if (!usersTableBody) return;
    
    usersTableBody.innerHTML = '';
    
    if (usersToRender.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td colspan="6" class="text-center py-4">
                <div class="text-muted">No users found</div>
            </td>
        `;
        usersTableBody.appendChild(row);
        return;
    }
    
    usersToRender.forEach(user => {
        const row = document.createElement('tr');
        
        // Format last active time
        const lastActive = user.lastSignInTime 
            ? formatTimeAgo(new Date(user.lastSignInTime))
            : 'Never';
            
        // Format creation date
        const createdAt = user.creationTime 
            ? new Date(user.creationTime).toLocaleDateString()
            : 'N/A';
        
        // Determine status badge
        const statusClass = user.isActive ? 'bg-success' : 'bg-secondary';
        const statusText = user.isActive ? 'Active' : 'Inactive';
        
        // Determine role badge
        let roleClass = 'bg-primary';
        let roleText = user.role.charAt(0).toUpperCase() + user.role.slice(1);
        
        if (user.role === 'admin') {
            roleClass = 'bg-danger';
            roleText = 'Administrator';
        } else if (user.role === 'instructor') {
            roleClass = 'bg-info';
            roleText = 'Instructor';
        }
        
        row.innerHTML = `
            <td>
                <div class="d-flex align-items-center">
                    <div class="avatar-xs me-2">
                        <span class="avatar-title rounded-circle bg-light text-primary">
                            ${user.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}
                        </span>
                    </div>
                    <div>
                        <h6 class="mb-0">${user.displayName || 'No Name'}</h6>
                        <small class="text-muted">${user.email}</small>
                    </div>
                </div>
            </td>
            <td>${user.email}</td>
            <td><span class="badge ${roleClass}">${roleText}</span></td>
            <td><span class="badge ${statusClass}">${statusText}</span></td>
            <td>${lastActive}</td>
            <td>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary view-user" data-user-id="${user.uid}">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-outline-secondary edit-user" data-user-id="${user.uid}">
                        <i class="fas fa-edit"></i>
                    </button>
                    ${user.role !== 'admin' ? `
                    <button class="btn btn-outline-danger delete-user" data-user-id="${user.uid}">
                        <i class="fas fa-trash"></i>
                    </button>
                    ` : ''}
                </div>
            </td>
        `;
        
        usersTableBody.appendChild(row);
    });
    
    // Add event listeners to action buttons
    addUserActionListeners();
}

// Add event listeners to user action buttons
export function addUserActionListeners() {
    // View user
    document.querySelectorAll('.view-user').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const userId = e.currentTarget.getAttribute('data-user-id');
            viewUser(userId);
        });
    });
    
    // Edit user
    document.querySelectorAll('.edit-user').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const userId = e.currentTarget.getAttribute('data-user-id');
            editUser(userId);
        });
    });
    
    // Delete user
    document.querySelectorAll('.delete-user').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const userId = e.currentTarget.getAttribute('data-user-id');
            confirmDeleteUser(userId);
        });
    });
}

// Update statistics
export function updateStats(users) {
    const totalUsers = users.length;
    const activeToday = users.filter(user => {
        if (!user.lastSignInTime) return false;
        const lastActive = new Date(user.lastSignInTime);
        const today = new Date();
        return lastActive.toDateString() === today.toDateString();
    }).length;
    
    const thisMonth = new Date().getMonth();
    const newThisMonth = users.filter(user => {
        if (!user.creationTime) return false;
        return new Date(user.creationTime).getMonth() === thisMonth;
    }).length;
    
    // Update UI
    const totalUsersEl = document.getElementById('totalUsers');
    const activeTodayEl = document.getElementById('activeToday');
    const newThisMonthEl = document.getElementById('newThisMonth');
    
    if (totalUsersEl) totalUsersEl.textContent = totalUsers;
    if (activeTodayEl) activeTodayEl.textContent = activeToday;
    if (newThisMonthEl) newThisMonthEl.textContent = newThisMonth;
}
