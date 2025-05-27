// --- API Helper ---
const BASE_API_URL = '/api'; // Adjust if your API is hosted elsewhere

async function fetchApi(endpoint, method = 'GET', data = null, requiresAuth = false) {
    const url = `${BASE_API_URL}${endpoint}`;
    const headers = {}; // Initialize empty headers
    
    // Only set Content-Type if data is not FormData
    // For FormData, the browser sets it automatically with the correct boundary
    if (!(data instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    const token = getToken();
    if (requiresAuth && token) {
        headers['Authorization'] = `Bearer ${token}`; // Assuming Bearer token scheme
    }

    const config = {
        method: method.toUpperCase(),
        headers: headers,
    };

    if (data) {
        if (data instanceof FormData) {
            config.body = data; // Send FormData directly
        } else if (method.toUpperCase() !== 'GET' && method.toUpperCase() !== 'HEAD') {
            config.body = JSON.stringify(data); // For JSON data
        }
    }

    try {
        const response = await fetch(url, config);
        const responseData = await response.json(); // Try to parse JSON regardless of status for error messages

        if (!response.ok) {
            // Log detailed error for debugging
            console.error('API Error:', response.status, responseData);
            // Prefer API's error message if available, otherwise use status text
            const message = responseData.error || responseData.message || response.statusText;
            throw new Error(message);
        }
        return responseData;
    } catch (error) {
        console.error('Fetch API Error:', error);
        // If it's an error from response.json() on a non-JSON response or network error
        if (error instanceof SyntaxError || error.message === 'Failed to fetch') {
             throw new Error('Network error or invalid server response.');
        }
        throw error; // Re-throw the error to be caught by the caller
    }
}

// --- Token Management ---
function storeToken(token) {
    localStorage.setItem('authToken', token);
}

function getToken() {
    return localStorage.getItem('authToken');
}

function removeToken() {
    localStorage.removeItem('authToken');
}

// --- Redirection ---
function redirectTo(page) {
    window.location.href = page;
}

// --- Current User ---
let currentUser = null; // Cache for current user details

async function getCurrentUser(forceRefresh = false) {
    if (currentUser && !forceRefresh) {
        return currentUser;
    }
    if (!getToken()) { // No token, no logged-in user
        currentUser = null;
        return null;
    }
    try {
        // This endpoint will be created in the backend
        const userData = await fetchApi('/me', 'GET', null, true); 
        currentUser = userData;
        return currentUser;
    } catch (error) {
        console.error('Error fetching current user:', error.message);
        // If token is invalid (e.g. 401 from /me), remove it
        if (error.message.includes('Authentication required') || error.message.includes('Invalid or expired token')) {
            removeToken();
        }
        currentUser = null;
        return null;
    }
}

// --- Utility for displaying messages ---
function displayMessage(elementId, message, type = 'error') {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = message;
        element.className = type === 'error' ? 'error-message' : 'success-message'; // Add CSS classes for styling
        element.style.display = 'block';
    } else {
        console.warn(`Element with ID '${elementId}' not found for displaying message.`);
    }
}

function clearMessage(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = '';
        element.style.display = 'none';
    }
}

// --- Logout Function ---
async function logoutUser() {
    try {
        // Call the backend logout endpoint if it does token invalidation or session clearing.
        // For simple localStorage token, just removing it client-side is often enough.
        // await fetchApi('/logout', 'POST', null, true); // Uncomment if backend /logout needs to be called
    } catch (error) {
        console.warn('Error during backend logout:', error.message);
        // Proceed with client-side logout anyway
    } finally {
        removeToken();
        currentUser = null;
        redirectTo('login_page.html'); // Or landing_page.html
    }
}

// Example: Add logout functionality to a button with id="logout-button"
// This should be placed in a script that runs after the DOM is loaded, or in specific page scripts.
// document.addEventListener('DOMContentLoaded', () => {
//     const logoutButton = document.getElementById('logout-button');
//     if (logoutButton) {
//         logoutButton.addEventListener('click', (e) => {
//             e.preventDefault();
//             logoutUser();
//         });
//     }
// });
