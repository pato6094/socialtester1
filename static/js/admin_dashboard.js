document.addEventListener('DOMContentLoaded', async function() {
    let currentUserDetails = null;

    // Header elements
    const userProfileButtonHeader = document.getElementById('user-profile-button-header');
    const userAvatarHeader = document.getElementById('user-avatar-header');
    const userNameHeader = document.getElementById('user-name-header');
    const userProfileDropdownHeader = document.getElementById('user-profile-dropdown-header');
    const viewProfileLinkHeader = document.getElementById('view-profile-link-header');
    const logoutButtonHeader = document.getElementById('logout-button-header');
    
    // Stats elements
    const statsTotalUsersEl = document.getElementById('stats-total-users');
    const statsNewUsersEl = document.getElementById('stats-new-users');
    const statsTotalPostsEl = document.getElementById('stats-total-posts');
    const statsTotalGroupsEl = document.getElementById('stats-total-groups');
    
    // Message area
    const adminMessagesDiv = document.getElementById('admin-messages');

    // User and Post Management Buttons and Containers
    const manageUsersButton = document.getElementById('manage-users-button');
    const usersListContainer = document.getElementById('users-list-container');
    const managePostsButton = document.getElementById('manage-posts-button');
    const postsListContainer = document.getElementById('posts-list-container');


    async function initializeAdminDashboard() {
        currentUserDetails = await getCurrentUser();
        if (!currentUserDetails) {
            redirectTo('login_page.html');
            return;
        }
        if (!currentUserDetails.is_admin) {
            displayMessage('admin-messages', 'Access Denied: You are not an administrator.', 'error');
            setTimeout(() => redirectTo('main_feed.html'), 3000);
            return;
        }

        setupAdminHeader();
        loadDashboardStats();

        if(manageUsersButton) {
            manageUsersButton.addEventListener('click', loadUsersList);
        }
        if(managePostsButton) {
            managePostsButton.addEventListener('click', loadPostsList);
        }
    }

    function setupAdminHeader() {
        if (userNameHeader && currentUserDetails) {
            userNameHeader.textContent = currentUserDetails.full_name + " (Admin)";
        }
        if (userAvatarHeader && currentUserDetails) {
            userAvatarHeader.src = currentUserDetails.profile_picture || 'https://via.placeholder.com/40';
        }
        if (viewProfileLinkHeader && currentUserDetails) {
            // Admin might want to see their own regular profile page
            viewProfileLinkHeader.href = `profile_page.html?user_id=${currentUserDetails.id}`;
        }

        if (userProfileButtonHeader && userProfileDropdownHeader) {
            userProfileButtonHeader.addEventListener('click', () => userProfileDropdownHeader.classList.toggle('hidden'));
            document.addEventListener('click', (event) => {
                if (userProfileDropdownHeader && !userProfileButtonHeader.contains(event.target) && !userProfileDropdownHeader.contains(event.target)) {
                    userProfileDropdownHeader.classList.add('hidden');
                }
            });
        }
        if (logoutButtonHeader) {
            logoutButtonHeader.addEventListener('click', logoutUser);
        }
    }

    async function loadDashboardStats() {
        try {
            const stats = await fetchApi('/admin/dashboard-stats', 'GET', null, true);
            if (statsTotalUsersEl) statsTotalUsersEl.textContent = stats.total_users ?? 'N/A';
            if (statsNewUsersEl) statsNewUsersEl.textContent = stats.new_users_last_7_days ?? 'N/A';
            if (statsTotalPostsEl) statsTotalPostsEl.textContent = stats.total_posts ?? 'N/A';
            if (statsTotalGroupsEl) statsTotalGroupsEl.textContent = stats.total_groups ?? 'N/A';
        } catch (error) {
            console.error('Error loading dashboard stats:', error);
            if(adminMessagesDiv) displayMessage('admin-messages', `Failed to load stats: ${error.message}`, 'error');
            if (statsTotalUsersEl) statsTotalUsersEl.textContent = 'Error';
            if (statsNewUsersEl) statsNewUsersEl.textContent = 'Error';
            if (statsTotalPostsEl) statsTotalPostsEl.textContent = 'Error';
            if (statsTotalGroupsEl) statsTotalGroupsEl.textContent = 'Error';
        }
    }
    
    // Placeholder functions for User and Post Management (to be implemented next)
    async function loadUsersList(page = 1, limit = 10) { 
        if(!usersListContainer) return;
        usersListContainer.innerHTML = '<p class="p-4 text-gray-500">Loading users...</p>';
        try {
            const usersData = await fetchApi(`/admin/users?page=${page}&limit=${limit}`, 'GET', null, true);
            usersListContainer.innerHTML = ''; // Clear loading message

            if (!usersData.items || usersData.items.length === 0) {
                usersListContainer.innerHTML = '<p class="p-4 text-gray-600">No users found.</p>';
                return;
            }

            const table = document.createElement('table');
            table.className = 'min-w-full bg-white divide-y divide-gray-200 shadow-sm rounded-lg';
            table.innerHTML = `
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Full Name</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Registered At</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                </tbody>
            `;
            const tbody = table.querySelector('tbody');
            usersData.items.forEach(user => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${user.id}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${user.full_name}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${user.email}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        ${currentUserDetails && user.id === currentUserDetails.id ? '(Current Admin)' : `<button data-user-id="${user.id}" class="text-red-600 hover:text-red-900 delete-user-button">Delete</button>`}
                    </td>
                `;
                tbody.appendChild(tr);
            });

            usersListContainer.appendChild(table);

            // Add event listeners for delete buttons
            document.querySelectorAll('.delete-user-button').forEach(button => {
                button.addEventListener('click', handleDeleteUser);
            });
            
            // Pagination for users list
            renderPagination(usersListContainer, usersData, loadUsersList);

        } catch (error) {
            console.error('Error loading users list:', error);
            if(usersListContainer) usersListContainer.innerHTML = `<p class="p-4 text-red-600">Failed to load users: ${error.message}</p>`;
        }
    }

    async function handleDeleteUser(event) {
        const userId = event.target.dataset.userId;
        if (!userId) return;

        if (confirm(`Are you sure you want to delete user ID ${userId}? This action cannot be undone.`)) {
            try {
                await fetchApi(`/admin/users/${userId}`, 'DELETE', null, true);
                if(adminMessagesDiv) displayMessage('admin-messages', `User ID ${userId} deleted successfully.`, 'success');
                loadUsersList(); // Refresh the list
            } catch (error) {
                console.error(`Error deleting user ID ${userId}:`, error);
                if(adminMessagesDiv) displayMessage('admin-messages', `Failed to delete user: ${error.message}`, 'error');
            }
        }
    }
    
    async function loadPostsList(page = 1, limit = 10) { 
        if(!postsListContainer) return;
        postsListContainer.innerHTML = '<p class="p-4 text-gray-500">Loading posts...</p>';
        try {
            const postsData = await fetchApi(`/admin/posts?page=${page}&limit=${limit}`, 'GET', null, true);
            postsListContainer.innerHTML = ''; // Clear loading message

            if (!postsData.items || postsData.items.length === 0) {
                postsListContainer.innerHTML = '<p class="p-4 text-gray-600">No posts found.</p>';
                return;
            }

            const table = document.createElement('table');
            table.className = 'min-w-full bg-white divide-y divide-gray-200 shadow-sm rounded-lg';
            table.innerHTML = `
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Author ID</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Content (Excerpt)</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created At</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Likes</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Comments</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                </tbody>
            `;
            const tbody = table.querySelector('tbody');
            postsData.items.forEach(post => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${post.id}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${post.user_id} (${post.author_full_name || 'N/A'})</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 max-w-xs truncate" title="${post.content}">${post.content.substring(0, 50)}${post.content.length > 50 ? '...' : ''}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${new Date(post.created_at).toLocaleDateString()}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${post.likes_count}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${post.comments_count}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button data-post-id="${post.id}" class="text-red-600 hover:text-red-900 delete-post-button">Delete</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });

            postsListContainer.appendChild(table);

            document.querySelectorAll('.delete-post-button').forEach(button => {
                button.addEventListener('click', handleDeletePost);
            });
            
            renderPagination(postsListContainer, postsData, loadPostsList);

        } catch (error) {
            console.error('Error loading posts list:', error);
            if(postsListContainer) postsListContainer.innerHTML = `<p class="p-4 text-red-600">Failed to load posts: ${error.message}</p>`;
        }
    }

    async function handleDeletePost(event) {
        const postId = event.target.dataset.postId;
        if (!postId) return;

        if (confirm(`Are you sure you want to delete post ID ${postId}?`)) {
            try {
                await fetchApi(`/admin/posts/${postId}`, 'DELETE', null, true);
                if(adminMessagesDiv) displayMessage('admin-messages', `Post ID ${postId} deleted successfully.`, 'success');
                loadPostsList(); // Refresh the list
            } catch (error) {
                console.error(`Error deleting post ID ${postId}:`, error);
                if(adminMessagesDiv) displayMessage('admin-messages', `Failed to delete post: ${error.message}`, 'error');
            }
        }
    }
    
    function renderPagination(container, paginatedData, loadFunction) {
        const existingPagination = container.querySelector('.pagination-controls');
        if (existingPagination) existingPagination.remove();

        if (paginatedData.total_pages <= 1) return;

        const paginationDiv = document.createElement('div');
        paginationDiv.className = 'pagination-controls mt-4 flex justify-between items-center';
        
        let buttonsHtml = '';
        if (paginatedData.page > 1) {
            buttonsHtml += `<button data-page="${paginatedData.page - 1}" class="px-3 py-1 border rounded text-sm hover:bg-gray-100">Previous</button>`;
        } else {
            buttonsHtml += `<button class="px-3 py-1 border rounded text-sm opacity-50 cursor-not-allowed">Previous</button>`;
        }

        buttonsHtml += `<span class="text-sm">Page ${paginatedData.page} of ${paginatedData.total_pages}</span>`;

        if (paginatedData.page < paginatedData.total_pages) {
            buttonsHtml += `<button data-page="${paginatedData.page + 1}" class="px-3 py-1 border rounded text-sm hover:bg-gray-100">Next</button>`;
        } else {
            buttonsHtml += `<button class="px-3 py-1 border rounded text-sm opacity-50 cursor-not-allowed">Next</button>`;
        }
        paginationDiv.innerHTML = buttonsHtml;

        paginationDiv.querySelectorAll('button[data-page]').forEach(button => {
            button.addEventListener('click', (e) => {
                loadFunction(parseInt(e.target.dataset.page));
            });
        });
        container.appendChild(paginationDiv);
    }


    initializeAdminDashboard();
});
