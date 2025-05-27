document.addEventListener('DOMContentLoaded', async function() {
    let loggedInUser = null;
    let viewedUser = null;
    let viewedUserId = null;

    // --- DOM Elements ---
    // Header (similar to feed.js, ideally make this a reusable component in a real app)
    const userProfileButtonHeader = document.getElementById('user-profile-button-header'); // Assuming you add this ID to profile_page.html header
    const userAvatarHeader = document.getElementById('user-avatar-header');
    const userNameHeader = document.getElementById('user-name-header');
    const userProfileDropdownHeader = document.getElementById('user-profile-dropdown-header');
    const viewProfileLinkHeader = document.getElementById('view-profile-link-header');
    const logoutButtonHeader = document.getElementById('logout-button-header');

    // Profile Page Specific Elements
    const profileAvatarElement = document.getElementById('profile-avatar'); // e.g. <img id="profile-avatar" ...>
    const profileNameElement = document.getElementById('profile-name'); // e.g. <h1 id="profile-name" ...>
    const profileBioElement = document.getElementById('profile-bio'); // e.g. <p id="profile-bio" ...>
    const profileStatsElement = document.getElementById('profile-stats'); // e.g. <p id="profile-stats" ...> (for followers/following)
    const profileActionButtonContainer = document.getElementById('profile-action-button-container'); // e.g. <div id="profile-action-button-container">
    const postsContainer = document.getElementById('profile-posts-container'); // e.g. <div id="profile-posts-container">
    const profileMessagesDiv = document.getElementById('profile-messages'); // For displaying messages

    // Edit Profile Modal Elements (assuming a modal structure will be added to HTML)
    const editProfileModal = document.getElementById('edit-profile-modal');
    const editProfileForm = document.getElementById('edit-profile-form');
    const newFullNameInput = document.getElementById('edit-full-name');
    const newBioInput = document.getElementById('edit-bio');
    const newProfilePictureInput = document.getElementById('edit-profile-picture'); // File input
    const cancelEditProfileButton = document.getElementById('cancel-edit-profile');


    // --- Initialization ---
    async function initializeProfilePage() {
        loggedInUser = await getCurrentUser();
        if (!loggedInUser) {
            redirectTo('login_page.html');
            return;
        }
        setupHeader(); // Setup common header elements

        const urlParams = new URLSearchParams(window.location.search);
        viewedUserId = urlParams.get('user_id');
        
        if (!viewedUserId || viewedUserId === String(loggedInUser.id)) {
            viewedUserId = loggedInUser.id; // Viewing own profile
            viewedUser = loggedInUser; // Already have details if it's loggedInUser from /me
            await loadProfileData(viewedUserId, true); // true for isOwnProfile
        } else {
            await loadProfileData(viewedUserId, false); // false for viewing another user's profile
        }
    }

    function setupHeader() {
        if (userNameHeader && loggedInUser) {
            userNameHeader.textContent = loggedInUser.full_name;
        }
        if (userAvatarHeader && loggedInUser) {
            userAvatarHeader.src = loggedInUser.profile_picture || 'https://via.placeholder.com/40';
        }
        if (viewProfileLinkHeader && loggedInUser) {
            viewProfileLinkHeader.href = `profile_page.html?user_id=${loggedInUser.id}`;
        }
        if (userProfileButtonHeader && userProfileDropdownHeader) {
            userProfileButtonHeader.addEventListener('click', () => userProfileDropdownHeader.classList.toggle('hidden'));
            document.addEventListener('click', (event) => {
                if (!userProfileButtonHeader.contains(event.target) && !userProfileDropdownHeader.contains(event.target)) {
                    userProfileDropdownHeader.classList.add('hidden');
                }
            });
        }
        if (logoutButtonHeader) {
            logoutButtonHeader.addEventListener('click', logoutUser);
        }
    }

    async function loadProfileData(userId, isOwnProfile) {
        // Display loading message
        if (profileNameElement) profileNameElement.textContent = 'Loading profile...';
        if (postsContainer) postsContainer.innerHTML = '<p class="text-gray-500">Loading posts...</p>';
        if (profileActionButtonContainer) profileActionButtonContainer.innerHTML = ''; // Clear action buttons

        try {
            const profileData = await fetchApi(`/profile/${userId}`, 'GET', null, true);
            viewedUser = profileData; // Store fetched profile data

            if (profileAvatarElement) profileAvatarElement.src = viewedUser.profile_picture || 'https://via.placeholder.com/128'; // Larger placeholder
            if (profileNameElement) profileNameElement.textContent = viewedUser.full_name;
            if (profileBioElement) profileBioElement.textContent = viewedUser.bio || 'No bio yet.';
            if (profileStatsElement) {
                 // Assuming API provides friends count as a proxy for followers/following
                profileStatsElement.textContent = `${viewedUser.friends?.length || 0} friends`; 
            }

            renderActionButtons(isOwnProfile, viewedUser.friendship_status_with_current_user); // friendship_status needs to be part of /profile API response
            renderPosts(viewedUser.posts || []);

        } catch (error) {
            console.error('Error loading profile data:', error);
            if(profileMessagesDiv) displayMessage('profile-messages', error.message || 'Failed to load profile.', 'error');
            else if(postsContainer) postsContainer.innerHTML = `<p class="text-red-500">Could not load profile: ${error.message}</p>`;
        }
    }

    function renderActionButtons(isOwnProfile, friendshipStatus) {
        if (!profileActionButtonContainer) return;
        profileActionButtonContainer.innerHTML = ''; // Clear previous buttons

        if (isOwnProfile) {
            const editProfileButton = document.createElement('button');
            editProfileButton.id = 'edit-profile-button';
            editProfileButton.textContent = 'Edit Profile';
            editProfileButton.className = 'px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300';
            editProfileButton.addEventListener('click', openEditProfileModal);
            profileActionButtonContainer.appendChild(editProfileButton);
        } else {
            const addFriendButton = document.createElement('button');
            addFriendButton.id = 'add-friend-button';
            // Determine button text/state based on friendshipStatus (NEEDS API MODIFICATION)
            // Example: if friendshipStatus is 'pending', 'friends', 'not_friends'
            if (friendshipStatus === 'friends') {
                addFriendButton.textContent = 'Friends';
                addFriendButton.disabled = true;
                addFriendButton.className = 'px-4 py-2 bg-green-500 text-white rounded disabled:opacity-75';
            } else if (friendshipStatus === 'pending_sent') { // Request sent by current user
                addFriendButton.textContent = 'Friend Request Sent';
                addFriendButton.disabled = true;
                addFriendButton.className = 'px-4 py-2 bg-yellow-500 text-white rounded disabled:opacity-75';
            } else if (friendshipStatus === 'pending_received') { // Current user received the request
                 addFriendButton.textContent = 'Respond to Friend Request';
                 addFriendButton.className = 'px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600';
                 addFriendButton.addEventListener('click', () => {
                    // Ideally, this would open a small modal/dropdown to accept/decline directly
                    // or redirect to a dedicated friend requests page.
                    // For now, just a message and log.
                    if(profileMessagesDiv) displayMessage('profile-messages', 'Please manage friend requests from your notifications or a dedicated requests page.', 'info');
                    console.log(`User ${loggedInUser.full_name} needs to respond to friend request from ${viewedUser.full_name} (ID: ${viewedUser.id})`);
                    // To implement accept/decline here, we'd need the friendship request ID.
                    // The /api/profile/<user_id> would need to return this ID if a pending request from viewedUser exists.
                 });
            }
            else { // Not friends / declined
                addFriendButton.textContent = 'Add Friend';
                addFriendButton.className = 'px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600';
                addFriendButton.addEventListener('click', handleAddFriend);
            }
            profileActionButtonContainer.appendChild(addFriendButton);
        }
    }

    function renderPosts(posts) {
        if (!postsContainer) return;
        postsContainer.innerHTML = ''; // Clear previous posts
        if (posts.length === 0) {
            postsContainer.innerHTML = '<p class="text-gray-500">No posts yet.</p>';
            return;
        }
        posts.forEach(post => {
            // Re-use createPostElement from feed.js or duplicate/adapt if structure is different
            // For now, assuming a similar structure. This needs careful management in a real app.
            const postElement = createProfilePostElement(post); 
            postsContainer.appendChild(postElement);
        });
    }
    
    // Adapted from feed.js - consider abstracting this if it's identical
    function createProfilePostElement(post) {
        const div = document.createElement('div');
        div.className = 'bg-white shadow-md rounded-lg p-4 mb-4 post-card-profile';
        div.dataset.postId = post.id;

        const isAuthor = loggedInUser && post.user_id === loggedInUser.id;
        const deleteButtonHtml = isAuthor ? 
            `<button class="delete-post-button-profile text-xs text-red-500 hover:text-red-700 ml-auto" data-post-id="${post.id}">Delete</button>` : '';

        div.innerHTML = `
            <div class="flex items-center mb-3">
                <img src="${viewedUser.profile_picture || 'https://via.placeholder.com/50'}" alt="${viewedUser.full_name}" class="w-10 h-10 rounded-full mr-3 object-cover">
                <div>
                    <p class="font-semibold text-gray-800">${viewedUser.full_name}</p>
                    <p class="text-xs text-gray-500">${new Date(post.created_at).toLocaleString()}</p>
                </div>
                ${deleteButtonHtml}
            </div>
            <p class="text-gray-700 mb-3 whitespace-pre-wrap">${post.content}</p>
            ${post.image_url ? `<img src="${post.image_url}" alt="Post image" class="rounded-lg mb-3 max-h-96 w-full object-cover">` : ''}
            <div class="flex items-center text-gray-500">
                <button data-post-id="${post.id}" class="like-button-profile flex items-center mr-4 hover:text-red-500">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1 like-icon-profile" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clip-rule="evenodd" /></svg> 
                    <span class="like-count-profile">${post.likes_count || 0}</span>
                </button>
                <button data-post-id="${post.id}" class="comment-button-profile flex items-center hover:text-blue-500">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17.668V13.5A7.962 7.962 0 012 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zm-4 0H9v2h2V9z" clip-rule="evenodd" /></svg>
                    <span class="comment-count-profile">${post.comments_count || 0}</span>
                </button>
            </div>
             <div class="mt-3 comments-section-profile hidden" id="comments-profile-for-${post.id}"></div>
             <div class="mt-2">
                 <input type="text" class="comment-input-profile w-full border rounded p-2 text-sm" placeholder="Write a comment..." data-post-id="${post.id}">
                 <button class="submit-comment-button-profile hidden mt-1 px-3 py-1 bg-blue-500 text-white rounded text-xs" data-post-id="${post.id}">Post</button>
            </div>
        `;
        // Attach event listeners for profile page posts (like, comment, delete)
        // These will call functions similar to those in feed.js but might target profile-specific elements
        // For simplicity, one might adapt feed.js functions or abstract them.
        // Attach event listeners
        const likeButton = div.querySelector('.like-button-profile');
        if (likeButton) {
            likeButton.addEventListener('click', () => handleProfilePostLike(post.id, div.querySelector('.like-count-profile'), div.querySelector('.like-icon-profile')));
        }

        const commentButton = div.querySelector('.comment-button-profile');
        if (commentButton) {
            commentButton.addEventListener('click', () => toggleProfilePostCommentsVisibility(post.id, div.querySelector(`#comments-profile-for-${post.id}`), commentButton));
        }

        const commentInput = div.querySelector('.comment-input-profile');
        const submitCommentButton = div.querySelector('.submit-comment-button-profile');
        if (commentInput && submitCommentButton) {
            commentInput.addEventListener('keypress', (e) => { 
                if (e.key === 'Enter' && commentInput.value.trim() !== '') { 
                    handleProfilePostCommentSubmit(post.id, commentInput.value.trim(), div); 
                    commentInput.value = ''; 
                } 
            });
            commentInput.addEventListener('focus', () => submitCommentButton.classList.remove('hidden'));
            submitCommentButton.addEventListener('click', () => { 
                if (commentInput.value.trim() !== '') { 
                    handleProfilePostCommentSubmit(post.id, commentInput.value.trim(), div); 
                    commentInput.value = ''; 
                } 
            });
        }

        if (isAuthor) {
            const deleteBtn = div.querySelector('.delete-post-button-profile');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', () => handleProfilePostDelete(post.id));
            }
        }
        return div;
    }

    async function handleAddFriend() {
        if (!viewedUserId || viewedUserId === loggedInUser.id) return;
        const button = document.getElementById('add-friend-button');
        if(button) button.disabled = true;

        try {
            await fetchApi('/friend-request', 'POST', { user_id: viewedUserId }, true);
            if(profileMessagesDiv) displayMessage('profile-messages', 'Friend request sent!', 'success');
            if(button) {
                button.textContent = 'Friend Request Sent';
                button.className = 'px-4 py-2 bg-yellow-500 text-white rounded disabled:opacity-75';
            }
        } catch (error) {
            if(profileMessagesDiv) displayMessage('profile-messages', error.message || 'Failed to send friend request.', 'error');
            if(button) button.disabled = false;
        }
    }
    
    function openEditProfileModal() {
        if (!editProfileModal || !loggedInUser) return;
        if (newFullNameInput) newFullNameInput.value = loggedInUser.full_name || '';
        if (newBioInput) newBioInput.value = loggedInUser.bio || '';
        // newProfilePictureInput.value = ''; // Clear file input for security/UX reasons
        editProfileModal.classList.remove('hidden');
    }

    if (editProfileForm) {
        editProfileForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            const fullName = newFullNameInput.value.trim();
            const bio = newBioInput.value.trim();
            const pictureFile = newProfilePictureInput.files[0];

            const formData = new FormData();
            if (fullName !== loggedInUser.full_name) formData.append('full_name', fullName);
            if (bio !== loggedInUser.bio) formData.append('bio', bio);
            if (pictureFile) formData.append('profile_picture_file', pictureFile); // Backend needs to handle this field name

            if (formData.entries().next().done && !pictureFile) { // Nothing changed
                if(profileMessagesDiv) displayMessage('profile-messages', 'No changes to save.', 'info');
                if (editProfileModal) editProfileModal.classList.add('hidden');
                return;
            }
            
            try {
                const updatedUser = await fetchApi('/profile', 'PUT', formData, true); // Requires fetchApi to handle FormData
                if(profileMessagesDiv) displayMessage('profile-messages', 'Profile updated successfully!', 'success');
                
                // Update UI and loggedInUser cache
                loggedInUser = { ...loggedInUser, ...updatedUser.user }; // Assuming API returns updated user under 'user' key
                viewedUser = loggedInUser; // If viewing own profile
                
                if (profileAvatarElement) profileAvatarElement.src = loggedInUser.profile_picture || 'https://via.placeholder.com/128';
                if (profileNameElement) profileNameElement.textContent = loggedInUser.full_name;
                if (profileBioElement) profileBioElement.textContent = loggedInUser.bio || 'No bio yet.';
                if (userAvatarHeader) userAvatarHeader.src = loggedInUser.profile_picture || 'https://via.placeholder.com/40';
                if (userNameHeader) userNameHeader.textContent = loggedInUser.full_name;


                if (editProfileModal) editProfileModal.classList.add('hidden');
            } catch (error) {
                 if(profileMessagesDiv) displayMessage('profile-messages', error.message || 'Failed to update profile.', 'error');
            }
        });
    }
    
    if (cancelEditProfileButton && editProfileModal) {
        cancelEditProfileButton.addEventListener('click', () => editProfileModal.classList.add('hidden'));
    }


    // --- Tab Functionality ---
    const tabs = document.querySelectorAll('a[data-tab]');
    const tabContents = {
        posts: document.getElementById('profile-posts-container'),
        likes: document.getElementById('profile-likes-container'),
        media: document.getElementById('profile-media-container')
    };

    tabs.forEach(tab => {
        tab.addEventListener('click', function(event) {
            event.preventDefault();
            const tabName = this.dataset.tab;

            tabs.forEach(t => {
                t.classList.remove('border-b-[#121417]', 'text-[#121417]');
                t.classList.add('border-b-transparent', 'text-[#677583]');
            });
            this.classList.add('border-b-[#121417]', 'text-[#121417]');
            this.classList.remove('border-b-transparent', 'text-[#677583]');

            for (const contentKey in tabContents) {
                if (tabContents[contentKey]) {
                    tabContents[contentKey].classList.add('hidden');
                }
            }
            if (tabContents[tabName]) {
                tabContents[tabName].classList.remove('hidden');
                // Load content for likes/media if not already loaded
                if (tabName === 'likes' && !tabContents.likes.dataset.loaded) {
                    loadProfileLikes(viewedUserId, tabContents.likes);
                } else if (tabName === 'media' && !tabContents.media.dataset.loaded) {
                    loadProfileMedia(viewedUserId, tabContents.media);
                }
            }
        });
    });

    async function loadProfileLikes(userId, container) {
        container.innerHTML = '<p class="text-gray-500">Loading liked posts...</p>';
        container.dataset.loaded = 'true'; // Mark as loaded to prevent multiple loads
        // TODO: Implement API endpoint /api/users/<userId>/likes and fetch/display liked posts
        // For now, placeholder:
        setTimeout(() => { // Simulate API call
             container.innerHTML = '<p class="text-gray-500">Liked posts functionality not yet implemented.</p>';
        }, 1000);
    }

    async function loadProfileMedia(userId, container) {
        container.innerHTML = '<p class="text-gray-500">Loading media...</p>';
        container.dataset.loaded = 'true';
        // TODO: Implement API endpoint /api/users/<userId>/media (posts with images/videos) and fetch/display
        // For now, placeholder:
         setTimeout(() => { // Simulate API call
            container.innerHTML = '<p class="text-gray-500">Media tab functionality not yet implemented.</p>';
        }, 1000);
    }


    // --- Initialize ---
    initializeProfilePage();
    
    // --- Post Interaction Functions (adapted from feed.js) ---
    // These need to be available in the global scope of this file or passed correctly.
    // For simplicity, defining them here. Consider abstracting if they become identical to feed.js.

    async function handleProfilePostLike(postId, likeCountElement, likeIconElement) {
        try {
            const response = await fetchApi(`/posts/${postId}/like`, 'POST', null, true);
            let currentLikes = parseInt(likeCountElement.textContent);
            if (response.message.toLowerCase().includes("unliked")) {
                likeCountElement.textContent = Math.max(0, currentLikes - 1);
                if(likeIconElement) likeIconElement.classList.remove('text-red-500');
            } else {
                likeCountElement.textContent = currentLikes + 1;
                if(likeIconElement) likeIconElement.classList.add('text-red-500');
            }
        } catch (error) {
            if(profileMessagesDiv) displayMessage('profile-messages', error.message || 'Failed to update like.', 'error');
        }
    }

    async function handleProfilePostCommentSubmit(postId, content, postElement) {
        if (!content.trim()) {
            if(profileMessagesDiv) displayMessage('profile-messages', 'Comment cannot be empty.', 'error');
            return;
        }
        try {
            const response = await fetchApi(`/posts/${postId}/comments`, 'POST', { content }, true);
            const newComment = response.comment;
            const commentsSection = postElement.querySelector(`#comments-profile-for-${postId}`);
            if (commentsSection) {
                const commentElement = createProfileCommentElement(newComment); // Use profile-specific creator
                commentsSection.appendChild(commentElement);
                if (commentsSection.classList.contains('hidden')) { // If it was hidden, show it.
                     commentsSection.classList.remove('hidden');
                }
            }
            const commentCountElement = postElement.querySelector('.comment-count-profile');
            if (commentCountElement) {
                commentCountElement.textContent = parseInt(commentCountElement.textContent) + 1;
            }
        } catch (error) {
            if(profileMessagesDiv) displayMessage('profile-messages', error.message || 'Failed to post comment.', 'error');
        }
    }
    
    function createProfileCommentElement(comment) { // Renamed to avoid conflict if abstracting
        const div = document.createElement('div');
        div.className = 'comment bg-gray-100 p-2 rounded-md mb-2 text-sm flex items-start space-x-2';
        const authorPic = comment.author_profile_picture || 'https://via.placeholder.com/30';
        div.innerHTML = `
            <img src="${authorPic}" alt="${comment.author_full_name || 'User'}" class="w-8 h-8 rounded-full object-cover">
            <div>
                <p><strong><a href="profile_page.html?user_id=${comment.user_id}" class="hover:underline">${comment.author_full_name || 'User'}</a>:</strong> ${comment.content}</p>
                <p class="text-xs text-gray-500">${new Date(comment.created_at).toLocaleString()}</p>
            </div>
        `;
        return div;
    }

    async function loadProfilePostComments(postId, commentsSection) {
        commentsSection.innerHTML = '<p class="text-xs text-gray-400 p-2">Loading comments...</p>';
        try {
            const comments = await fetchApi(`/posts/${postId}/comments`, 'GET', null, true);
            commentsSection.innerHTML = '';
            if (comments && comments.length > 0) {
                comments.forEach(comment => {
                    commentsSection.appendChild(createProfileCommentElement(comment));
                });
            } else {
                commentsSection.innerHTML = '<p class="text-xs text-gray-500 p-2">No comments yet.</p>';
            }
        } catch (error) {
            commentsSection.innerHTML = `<p class="text-xs text-red-500 p-2">Failed to load comments.</p>`;
        }
    }

    function toggleProfilePostCommentsVisibility(postId, commentsSection, commentButton) {
        const isHidden = commentsSection.classList.toggle('hidden');
        if (!isHidden) {
            loadProfilePostComments(postId, commentsSection);
            if(commentButton) commentButton.classList.add('text-blue-500');
        } else {
            if(commentButton) commentButton.classList.remove('text-blue-500');
        }
    }
    
    async function handleProfilePostDelete(postId) {
        if (!confirm('Are you sure you want to delete this post?')) return;
        try {
            // User can only delete their own posts. Backend should enforce this.
            // The endpoint might be /api/posts/<postId> for user-owned posts or /api/admin/posts/<postId> for admins.
            // Assuming /api/posts/<postId> with DELETE method for owned posts.
            await fetchApi(`/posts/${postId}`, 'DELETE', null, true); 
            if(profileMessagesDiv) displayMessage('profile-messages', 'Post deleted successfully.', 'success');
            const postElement = document.querySelector(`.post-card-profile[data-post-id="${postId}"]`);
            if (postElement) postElement.remove();
        } catch (error) {
            if(profileMessagesDiv) displayMessage('profile-messages', error.message || 'Failed to delete post.', 'error');
        }
    }

    // Update createProfilePostElement to attach these new handlers
    // This requires re-defining or modifying createProfilePostElement to be aware of these handlers.
    // The previous definition of createProfilePostElement in this file needs to be updated:
    // Search for: function createProfilePostElement(post)
    // And in its body, after setting innerHTML, add:
    // div.querySelector('.like-button-profile').addEventListener('click', () => handleProfilePostLike(post.id, div.querySelector('.like-count-profile'), div.querySelector('.like-icon-profile')));
    // div.querySelector('.comment-button-profile').addEventListener('click', () => toggleProfilePostCommentsVisibility(post.id, div.querySelector(`#comments-profile-for-${post.id}`), div.querySelector('.comment-button-profile')));
    // const commentInput = div.querySelector('.comment-input-profile');
    // const submitCommentButton = div.querySelector('.submit-comment-button-profile');
    // commentInput.addEventListener('keypress', (e) => { if (e.key === 'Enter' && commentInput.value.trim() !== '') { handleProfilePostCommentSubmit(post.id, commentInput.value.trim(), div); commentInput.value = ''; } });
    // submitCommentButton.addEventListener('click', () => { if (commentInput.value.trim() !== '') { handleProfilePostCommentSubmit(post.id, commentInput.value.trim(), div); commentInput.value = ''; } });
    // if (isAuthor) { const deleteBtn = div.querySelector('.delete-post-button-profile'); if (deleteBtn) { deleteBtn.addEventListener('click', () => handleProfilePostDelete(post.id)); } }

});
