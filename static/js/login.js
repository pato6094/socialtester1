document.addEventListener('DOMContentLoaded', function() {
    const inputs = document.querySelectorAll('input.form-input');
    const emailInput = Array.from(inputs).find(input => input.placeholder === 'Email');
    const passwordInput = Array.from(inputs).find(input => input.placeholder === 'Password');

    const loginButton = Array.from(document.querySelectorAll('button span'))
                             .find(span => span.textContent.trim().toLowerCase() === 'log in')
                             ?.closest('button');
    
    const forgotPasswordLink = Array.from(document.querySelectorAll('p a, p')) // Check both <a> and <p>
                                   .find(el => el.textContent.trim().toLowerCase() === 'forgot password?');

    // Add a div for messages if not present
    let messageDiv = document.getElementById('login-message');
    if (!messageDiv && loginButton) {
        messageDiv = document.createElement('div');
        messageDiv.id = 'login-message';
        messageDiv.style.marginTop = '10px'; // Basic styling
        messageDiv.style.textAlign = 'center';
        // Insert before the "Forgot password?" link or after the button if the link isn't there
        const parentOfButton = loginButton.parentNode;
         if (forgotPasswordLink && forgotPasswordLink.parentNode === parentOfButton.parentNode) {
             parentOfButton.parentNode.insertBefore(messageDiv, forgotPasswordLink);
        } else if (parentOfButton) {
             parentOfButton.parentNode.insertBefore(messageDiv, parentOfButton.nextSibling);
        }
    }

    if (!emailInput || !passwordInput) {
        console.error('Email or Password input field not found.');
        if(messageDiv) displayMessage('login-message', 'Page setup error. Please contact support.', 'error');
        return;
    }

    if (loginButton) {
        loginButton.addEventListener('click', async function(event) {
            event.preventDefault();
            clearMessage('login-message');

            const email = emailInput.value.trim();
            const password = passwordInput.value;

            if (!email || !password) {
                displayMessage('login-message', 'Email and password are required.', 'error');
                return;
            }

            try {
                const data = { email, password };
                // The /api/login endpoint in backend/app.py expects requiresAuth = false
                // because it's the process of authenticating. Token is set *after* successful login.
                const response = await fetchApi('/login', 'POST', data, false); 

                if (response.token) {
                    storeToken(response.token);
                    // Fetch current user details to check if admin and to cache user info
                    const user = await getCurrentUser(true); // Force refresh after login
                    if (user) {
                        if (user.is_admin) { // Check the is_admin flag from /api/me
                            redirectTo('admin_dashboard.html');
                        } else {
                            redirectTo('main_feed.html');
                        }
                    } else {
                        // Should not happen if login was successful and /api/me works
                        displayMessage('login-message', 'Login successful, but failed to retrieve user details.', 'error');
                        removeToken(); // Clean up inconsistent state
                    }
                } else {
                    // This case should ideally be caught by the !response.ok in fetchApi
                    displayMessage('login-message', response.error || 'Login failed: No token received.', 'error');
                }
            } catch (error) {
                displayMessage('login-message', error.message || 'Login failed. Please check your credentials.', 'error');
            }
        });
    } else {
        console.warn('Login button not found.');
    }

    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', function(event) {
            event.preventDefault();
            redirectTo('password_reset_request.html');
        });
         // Make it look like a link if it's a <p> tag
        if (forgotPasswordLink.tagName === 'P') {
            forgotPasswordLink.style.cursor = 'pointer';
            // underline is already there via class
        }
    } else {
        console.warn('Forgot password link not found.');
    }
});
