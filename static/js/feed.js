document.addEventListener('DOMContentLoaded', async function() {
    let currentUserDetails = null;
    const feedContainer = document.getElementById('feed-container');
    const friendsListContainer = document.getElementById('friends-list-container');
    
    // Header elements for user profile
    const userProfileButton = document.getElementById('user-profile-button');
    const userAvatarHeader = document.getElementById('user-avatar-header');
    const userNameHeader = document.getElementById('user-name-header');
    const userProfileDropdown = document.getElementById('user-profile-dropdown');
    const viewProfileLink = document.getElementById('view-profile-link');
    const logoutButtonHeader = document.getElementById('logout-button-header');

    // New Post elements (inline form)
    const newPostContentInput = document.getElementById('new-post-content');
    const newPostImageInput = document.getElementById('new-post-image');
    const submitNewPostButton = document.getElementById('submit-new-post');

    // New Post Modal elements
    const newPostModal = document.getElementById('new-post-modal');
    // const openNewPostModalButton = document.getElementById('open-new-post-modal-button'); // If we add a separate button for modal
    const modalNewPostContentInput = document.getElementById('modal-new-post-content');
    const modalNewPostImageInput = document.getElementById('modal-new-post-image');
    const modalSubmitNewPostButton = document.getElementById('modal-submit-new-post');
    const modalCancelNewPostButton = document.getElementById('modal-cancel-new-post');
    
    // Create Group Modal elements
    const createGroupModal = document.getElementById('create-group-modal');
    const createGroupButtonSidebar = document.getElementById('create-group-button'); // Button in sidebar
    const modalGroupNameInput = document.getElementById('modal-group-name');
    const modalGroupDescriptionInput = document.getElementById('modal-group-description');
    const modalSubmitCreateGroupButton = document.getElementById('modal-submit-create-group');
    const modalCancelCreateGroupButton = document.getElementById('modal-cancel-create-group');

    // Search elements
    const searchInputHeader = document.querySelector('header input[placeholder="Search"]');
    const searchResultsContainer = document.getElementById('search-results-container');


    // --- Initial Page Setup ---
    async function initializePage() {
        currentUserDetails = await getCurrentUser();
        if (!currentUserDetails) {
            redirectTo('login_page.html');
            return;
        }

        // Update header with user details
        if (userNameHeader) {
            userNameHeader.textContent = currentUserDetails.full_name;
        }
        if (userAvatarHeader) {
            if (currentUserDetails.profile_picture) {
                userAvatarHeader.src = currentUserDetails.profile_picture;
            } else {
                userAvatarHeader.src = 'https://via.placeholder.com/40'; // Default avatar
            }
        }
        if (viewProfileLink) {
            viewProfileLink.href = `profile_page.html?user_id=${currentUserDetails.id}`;
        }

        // Setup header dropdown
        if (userProfileButton && userProfileDropdown) {
            userProfileButton.addEventListener('click', () => {
                userProfileDropdown.classList.toggle('hidden');
            });
            // Close dropdown if clicking outside
            document.addEventListener('click', (event) => {
                if (!userProfileButton.contains(event.target) && !userProfileDropdown.contains(event.target)) {
                    userProfileDropdown.classList.add('hidden');
                }
            });
        }
        
        if (logoutButtonHeader) {
            logoutButtonHeader.addEventListener('click', logoutUser);
        }

        // Setup New Post (inline)
        if (submitNewPostButton) {
            submitNewPostButton.addEventListener('click', () => handleNewPostSubmit(false)); // false for not modal
        }
        
        // Setup Modals
        setupModal(null, newPostModal, modalCancelNewPostButton); // No dedicated open button for new post modal by default
        setupModal(createGroupButtonSidebar, createGroupModal, modalCancelCreateGroupButton);

        if (modalSubmitNewPostButton) {
             modalSubmitNewPostButton.addEventListener('click', () => handleNewPostSubmit(true)); // true for modal
        }
        if (modalSubmitCreateGroupButton) {
            modalSubmitCreateGroupButton.addEventListener('click', handleCreateGroupSubmit);
        }
        
        // Setup Search
        if (searchInputHeader) {
            searchInputHeader.addEventListener('input', handleSearchInput);
             // Close search results if clicking outside
            document.addEventListener('click', (event) => {
                if (searchResultsContainer && !searchInputHeader.contains(event.target) && !searchResultsContainer.contains(event.target)) {
                    searchResultsContainer.classList.add('hidden');
                    searchResultsContainer.innerHTML = '';
                }
            });
        }


        loadFeed();
        loadFriendsList();
        // loadChats(); // Placeholder for chat functionality
    }

    // --- Modal Helper ---
    function setupModal(openButton, modal, closeButton) {
        if (openButton && modal) {
            openButton.addEventListener('click', () => modal.classList.remove('hidden'));
        }
        if (closeButton && modal) {
            closeButton.addEventListener('click', () => modal.classList.add('hidden'));
        }
        if (modal) { // Close modal if clicking on the background overlay
            modal.addEventListener('click', (event) => {
                if (event.target === modal) {
                    modal.classList.add('hidden');
                }
            });
        }
    }
    
    // --- Load Feed ---
    async function loadFeed(page = 1, limit = 10) {
        if (!feedContainer) {
            console.warn('Feed container not found.');
            return;
        }
        const loadingIndicator = document.createElement('p');
        loadingIndicator.textContent = 'Loading feed...';
        loadingIndicator.id = 'feed-loading-indicator';
        loadingIndicator.className = 'text-center text-gray-500 py-4';

        if (page === 1) {
            feedContainer.innerHTML = ''; // Clear for first page
            feedContainer.appendChild(loadingIndicator);
        } else {
            const existingLoadMoreButton = document.getElementById('load-more-feed');
            if (existingLoadMoreButton) existingLoadMoreButton.insertAdjacentElement('beforebegin', loadingIndicator);
            else feedContainer.appendChild(loadingIndicator); // Append if no button (e.g. after error)
        }
        
        try {
            const feedData = await fetchApi(`/feed?page=${page}&limit=${limit}`, 'GET', null, true);
            
            if (document.getElementById('feed-loading-indicator')) {
                 document.getElementById('feed-loading-indicator').remove();
            }

            if (page === 1 && (!feedData.items || feedData.items.length === 0)) {
                 feedContainer.innerHTML = '<p class="text-gray-500 text-center py-4">Your feed is empty. Connect with friends or make a post!</p>';
                 return;
            }

            if (feedData.items && feedData.items.length > 0) {
                feedData.items.forEach(post => {
                    const postElement = createPostElement(post);
                    feedContainer.appendChild(postElement);
                });

                const oldLoadMoreButton = document.getElementById('load-more-feed');
                if(oldLoadMoreButton) oldLoadMoreButton.remove();

                if (feedData.page < feedData.total_pages) {
                    const loadMoreButton = document.createElement('button');
                    loadMoreButton.id = 'load-more-feed';
                    loadMoreButton.textContent = 'Load More Posts';
                    loadMoreButton.className = 'mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 w-full';
                    loadMoreButton.addEventListener('click', () => {
                        loadFeed(feedData.page + 1, limit);
                    });
                    feedContainer.appendChild(loadMoreButton);
                }
            }
        } catch (error) {
            console.error('Error loading feed:', error);
            const currentLoadingIndicator = document.getElementById('feed-loading-indicator');
            if (currentLoadingIndicator) currentLoadingIndicator.remove();
            
            // If it's the first page and it fails, show error in feed container
            if (page === 1 && feedContainer) {
                 feedContainer.innerHTML = `<p class="text-red-500 text-center py-4">Failed to load feed: ${error.message}</p>`;
            } else { // For subsequent pages or if feedContainer is not primary error display
                 displayMessage('feed-messages', error.message || 'Failed to load more posts.', 'error');
            }
        }
    }
    
    function createPostElement(post) {
        const div = document.createElement('div');
        div.className = 'bg-white shadow-md rounded-lg p-4 mb-4 post-card'; // Added post-card class
        div.dataset.postId = post.id; // Store post ID on the element

        const isAuthor = currentUserDetails && post.user_id === currentUserDetails.id;
        const deleteButtonHtml = isAuthor ? 
            `<button class="delete-post-button text-xs text-red-500 hover:text-red-700 ml-auto" data-post-id="${post.id}">Delete</button>` : '';

        div.innerHTML = `
            <div class="flex items-center mb-3">
                <img src="${post.author_profile_picture || 'https://via.placeholder.com/50'}" alt="${post.author_full_name}" class="w-10 h-10 rounded-full mr-3 object-cover">
                <div>
                    <a href="profile_page.html?user_id=${post.user_id}" class="font-semibold text-gray-800 hover:underline">${post.author_full_name}</a>
                    <p class="text-xs text-gray-500">${new Date(post.created_at).toLocaleString()}</p>
                </div>
                ${deleteButtonHtml}
            </div>
            <p class="text-gray-700 mb-3 whitespace-pre-wrap">${post.content}</p>
            ${post.image_url ? `<img src="${post.image_url}" alt="Post image" class="rounded-lg mb-3 max-h-96 w-full object-cover">` : ''}
            <div class="flex items-center text-gray-500">
                <button data-post-id="${post.id}" class="like-button flex items-center mr-4 hover:text-red-500">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1 like-icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clip-rule="evenodd" /></svg> 
                    <span class="like-count">${post.likes_count || 0}</span>
                </button>
                <button data-post-id="${post.id}" class="comment-button flex items-center hover:text-blue-500">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17.668V13.5A7.962 7.962 0 012 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zm-4 0H9v2h2V9z" clip-rule="evenodd" /></svg>
                    <span class="comment-count">${post.comments_count || 0}</span>
                </button>
            </div>
            <div class="mt-3 comments-section hidden" id="comments-for-${post.id}">
                <!-- Comments will be loaded here -->
            </div>
            <div class="mt-2">
                 <input type="text" class="comment-input w-full border rounded p-2 text-sm" placeholder="Write a comment..." data-post-id="${post.id}">
                 <button class="submit-comment-button hidden mt-1 px-3 py-1 bg-blue-500 text-white rounded text-xs" data-post-id="${post.id}">Post</button>
            </div>
        `;
        
        const likeButton = div.querySelector('.like-button');
        likeButton.addEventListener('click', () => toggleLike(post.id, div.querySelector('.like-count'), div.querySelector('.like-icon')));
        
        const commentButton = div.querySelector('.comment-button');
        commentButton.addEventListener('click', () => toggleCommentsVisibility(post.id, div.querySelector('.comments-section'), commentButton));
        
        const commentInput = div.querySelector('.comment-input');
        const submitCommentButton = div.querySelector('.submit-comment-button');
        commentInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && commentInput.value.trim() !== '') {
                submitComment(post.id, commentInput.value.trim(), div);
                commentInput.value = ''; 
            }
        });
        commentInput.addEventListener('focus', () => submitCommentButton.classList.remove('hidden'));
        submitCommentButton.addEventListener('click', () => {
             if (commentInput.value.trim() !== '') {
                submitComment(post.id, commentInput.value.trim(), div);
                commentInput.value = '';
             }
        });

        if (isAuthor) {
            const deleteBtn = div.querySelector('.delete-post-button');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', () => handleDeletePost(post.id));
            }
        }
        return div;
    }

    // --- Load Friends List (Sidebar) ---
    async function loadFriendsList() {
        if (!friendsListContainer) {
            console.warn('Friends list container not found.');
            return;
        }
        friendsListContainer.innerHTML = '<p class="text-sm text-gray-600">Loading friends...</p>';
        try {
            const friends = await fetchApi('/friends', 'GET', null, true);
            friendsListContainer.innerHTML = ''; 
            if (friends && friends.length > 0) {
                friends.forEach(friend => {
                    const friendElement = document.createElement('a');
                    friendElement.href = `profile_page.html?user_id=${friend.id}`;
                    friendElement.className = 'flex items-center p-2 hover:bg-gray-200 rounded transition-colors duration-150';
                    friendElement.innerHTML = `
                        <img src="${friend.profile_picture || 'https://via.placeholder.com/40'}" alt="${friend.full_name}" class="w-8 h-8 rounded-full mr-2 object-cover">
                        <span class="text-sm text-gray-700">${friend.full_name}</span>
                    `;
                    friendsListContainer.appendChild(friendElement);
                });
            } else {
                friendsListContainer.innerHTML = '<p class="text-sm text-gray-500 text-center">No friends to show.</p>';
            }
        } catch (error) {
            console.error('Error loading friends list:', error);
            friendsListContainer.innerHTML = '<p class="text-sm text-red-500">Failed to load friends.</p>';
        }
    }
    
    // --- New Post Functionality ---
    async function handleNewPostSubmit(isModal = false) {
        const contentEl = isModal ? modalNewPostContentInput : newPostContentInput;
        const imageEl = isModal ? modalNewPostImageInput : newPostImageInput;
        const submitBtn = isModal ? modalSubmitNewPostButton : submitNewPostButton;
        
        const content = contentEl.value.trim();
        const imageFile = imageEl.files[0];

        if (!content && !imageFile) { // Check if backend allows content-only or image-only posts
            displayMessage('feed-messages', 'Post content or an image is required.', 'error');
            return;
        }
        
        if(submitBtn) submitBtn.disabled = true;

        const formData = new FormData();
        formData.append('content', content); // Content can be empty if image is present
        if (imageFile) {
            formData.append('image', imageFile);
        }

        try {
            // fetchApi needs to be adjusted to handle FormData (omit Content-Type: application/json for FormData)
            // For this to work, main.js's fetchApi needs a check for FormData in the 'data' argument.
            // If data is FormData, it should not set 'Content-Type': 'application/json'.
            const newPostResponse = await fetchApi('/posts', 'POST', formData, true); // Requires fetchApi modification
            
            displayMessage('feed-messages', newPostResponse.message || 'Post created successfully!', 'success');
            
            contentEl.value = '';
            imageEl.value = null;

            loadFeed(); // Refresh the entire feed
            if (isModal && newPostModal) newPostModal.classList.add('hidden');

        } catch (error) {
            displayMessage('feed-messages', error.message || 'Failed to create post.', 'error');
        } finally {
            if(submitBtn) submitBtn.disabled = false;
        }
    }
    
    // --- Create Group Functionality ---
    async function handleCreateGroupSubmit() {
        const name = modalGroupNameInput.value.trim();
        const description = modalGroupDescriptionInput.value.trim();

        if (!name) {
            // Display message inside modal or globally
            // For now, using global feed-messages; ideally modal has its own message area.
            displayMessage('feed-messages', 'Group name is required.', 'error');
            return;
        }
        
        modalSubmitCreateGroupButton.disabled = true;

        try {
            const groupResponse = await fetchApi('/groups', 'POST', { name, description }, true);
            displayMessage('feed-messages', groupResponse.message || `Group '${name}' created successfully!`, 'success');
            modalGroupNameInput.value = '';
            modalGroupDescriptionInput.value = '';
            if (createGroupModal) createGroupModal.classList.add('hidden');
            // Optionally, refresh a list of user's groups if displayed on the page
        } catch (error) {
            displayMessage('feed-messages', error.message || 'Failed to create group.', 'error');
        } finally {
            modalSubmitCreateGroupButton.disabled = false;
        }
    }

    // --- Search Functionality ---
    let searchTimeout;
    async function handleSearchInput(event) {
        const query = event.target.value.trim();
        
        if (!searchResultsContainer) return;

        searchResultsContainer.innerHTML = ''; 
        
        if (query.length < 2) {
            searchResultsContainer.classList.add('hidden');
            return;
        }
        searchResultsContainer.classList.remove('hidden');
        searchResultsContainer.innerHTML = '<p class="text-sm text-gray-500 p-2">Searching...</p>';


        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(async () => {
            try {
                const users = await fetchApi(`/users?q=${encodeURIComponent(query)}`, 'GET', null, true);
                searchResultsContainer.innerHTML = ''; // Clear "Searching..." or previous results
                if (users && users.length > 0) {
                    users.forEach(user => {
                        const userElement = document.createElement('a');
                        userElement.href = `profile_page.html?user_id=${user.id}`;
                        userElement.className = 'flex items-center p-2 hover:bg-gray-100 rounded transition-colors duration-150';
                        userElement.innerHTML = `
                            <img src="${user.profile_picture || 'https://via.placeholder.com/30'}" alt="${user.full_name}" class="w-8 h-8 rounded-full mr-2 object-cover">
                            <span class="text-sm text-gray-700">${user.full_name}</span>
                        `;
                        searchResultsContainer.appendChild(userElement);
                    });
                } else {
                    searchResultsContainer.innerHTML = '<p class="text-sm text-gray-500 p-2">No users found.</p>';
                }
            } catch (error) {
                console.error('Search error:', error);
                searchResultsContainer.innerHTML = `<p class="text-sm text-red-500 p-2">Search failed: ${error.message}</p>`;
            }
        }, 300); 
    }
    
    // Ensure feed-messages div exists (from HTML modification)
    // const feedMessagesDiv = document.getElementById('feed-messages');
    // if (!feedMessagesDiv) {
    //     console.warn("The div with id 'feed-messages' is missing from main_feed.html. Messages may not display correctly.");
    // }

    // --- Initialize ---
    initializePage();
});

// Stubs for functions to be implemented later (Like, Comment, Delete Post)

async function toggleLike(postId, likeCountElement, likeIconElement) {
    try {
        const response = await fetchApi(`/posts/${postId}/like`, 'POST', null, true);
        // The backend currently returns a message. For dynamic like count, it ideally returns the new count or post object.
        // For now, we'll just optimistically update or re-fetch the post/feed for simplicity if backend doesn't return count.
        // Let's assume the backend response.message tells us "Post liked" or "Post unliked".
        
        // Optimistic update:
        let currentLikes = parseInt(likeCountElement.textContent);
        if (response.message.toLowerCase().includes("unliked")) {
            likeCountElement.textContent = Math.max(0, currentLikes - 1);
            if(likeIconElement) likeIconElement.classList.remove('text-red-500'); // Assuming text-red-500 means liked
        } else {
            likeCountElement.textContent = currentLikes + 1;
            if(likeIconElement) likeIconElement.classList.add('text-red-500');
        }
        // To get the "is_liked_by_current_user" state, the API should ideally return it.
        // Or, the like button could store its state.
    } catch (error) {
        console.error(`Error toggling like for post ${postId}:`, error);
        displayMessage('feed-messages', error.message || 'Failed to update like.', 'error');
    }
}

async function submitComment(postId, content, postElement) {
    if (!content.trim()) {
        displayMessage('feed-messages', 'Comment cannot be empty.', 'error');
        return;
    }
    try {
        const response = await fetchApi(`/posts/${postId}/comments`, 'POST', { content }, true);
        const newComment = response.comment; // Assuming backend returns the created comment object

        const commentsSection = postElement.querySelector(`#comments-for-${postId}`);
        if (commentsSection) { // If comments section is open, append new comment
            const commentElement = createCommentElement(newComment);
            commentsSection.appendChild(commentElement);
            commentsSection.classList.remove('hidden'); // Ensure it's visible
        }
        
        // Update comment count on the post
        const commentCountElement = postElement.querySelector('.comment-button .comment-count');
        if (commentCountElement) {
            let currentCount = parseInt(commentCountElement.textContent);
            commentCountElement.textContent = currentCount + 1;
        }
        displayMessage('feed-messages', 'Comment posted!', 'success');
    } catch (error) {
        console.error(`Error submitting comment for post ${postId}:`, error);
        displayMessage('feed-messages', error.message || 'Failed to post comment.', 'error');
    }
}

async function loadComments(postId, commentsSection) {
    commentsSection.innerHTML = '<p class="text-xs text-gray-400 p-2">Loading comments...</p>';
    try {
        const comments = await fetchApi(`/posts/${postId}/comments`, 'GET', null, true);
        commentsSection.innerHTML = ''; // Clear loading message
        if (comments && comments.length > 0) {
            comments.forEach(comment => {
                const commentElement = createCommentElement(comment);
                commentsSection.appendChild(commentElement);
            });
        } else {
            commentsSection.innerHTML = '<p class="text-xs text-gray-500 p-2">No comments yet.</p>';
        }
    } catch (error) {
        console.error(`Error loading comments for post ${postId}:`, error);
        commentsSection.innerHTML = `<p class="text-xs text-red-500 p-2">Failed to load comments: ${error.message}</p>`;
    }
}

function createCommentElement(comment) {
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

function toggleCommentsVisibility(postId, commentsSection, commentButton) {
    const isHidden = commentsSection.classList.toggle('hidden');
    if (!isHidden) { // If comments are now visible, load them
        loadComments(postId, commentsSection);
        commentButton.classList.add('text-blue-500'); // Indicate comments are open
    } else {
        commentButton.classList.remove('text-blue-500');
    }
}

async function handleDeletePost(postId) {
    if (!confirm('Are you sure you want to delete this post?')) {
        return;
    }
    try {
        await fetchApi(`/admin/posts/${postId}`, 'DELETE', null, true); // Assuming admin rights allow deleting own posts, or use /api/posts/<id>
        displayMessage('feed-messages', 'Post deleted successfully.', 'success');
        // Remove post from UI
        const postElement = document.querySelector(`.post-card[data-post-id="${postId}"]`);
        if (postElement) {
            postElement.remove();
        }
        // Optionally, reload the feed: loadFeed();
    } catch (error) {
        console.error(`Error deleting post ${postId}:`, error);
        displayMessage('feed-messages', error.message || 'Failed to delete post.', 'error');
    }
}

// function updateLikeButtonState(button, isLiked) {
//     const likeIcon = button.querySelector('.like-icon');
//     if (isLiked) {
//         if(likeIcon) likeIcon.classList.add('text-red-500'); // Filled heart or different color
//     } else {
//         if(likeIcon) likeIcon.classList.remove('text-red-500'); // Outline heart
//     }
// }
