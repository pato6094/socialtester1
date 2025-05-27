document.addEventListener('DOMContentLoaded', function() {
    const inputs = document.querySelectorAll('input.form-input');
    const fullNameInput = Array.from(inputs).find(input => input.placeholder === 'Full Name');
    const emailInput = Array.from(inputs).find(input => input.placeholder === 'Email');
    const passwordInput = Array.from(inputs).find(input => input.placeholder === 'Password');
    const confirmPasswordInput = Array.from(inputs).find(input => input.placeholder === 'Confirm Password');

    const registerButton = Array.from(document.querySelectorAll('button span'))
                               .find(span => span.textContent.trim() === 'Register')
                               ?.closest('button');
    
    const loginLink = Array.from(document.querySelectorAll('p a, p')) // Check both <a> and <p> for the text
                           .find(el => el.textContent.trim().toLowerCase() === 'back to login');

    // Add a div for messages if not present
    let messageDiv = document.getElementById('registration-message');
    if (!messageDiv && registerButton) {
        messageDiv = document.createElement('div');
        messageDiv.id = 'registration-message';
        messageDiv.style.marginTop = '10px'; // Basic styling
        messageDiv.style.textAlign = 'center';
        // Insert before the "Back to Login" link or after the button if the link isn't there
        const parentOfButton = registerButton.parentNode;
        if (loginLink && loginLink.parentNode === parentOfButton.parentNode) { // if link is sibling of button's parent
             parentOfButton.parentNode.insertBefore(messageDiv, loginLink.nextSibling);
        } else if (parentOfButton) {
            parentOfButton.parentNode.insertBefore(messageDiv, parentOfButton.nextSibling);
        }
    }


    if (!fullNameInput || !emailInput || !passwordInput || !confirmPasswordInput) {
        console.error('One or more input fields could not be found.');
        if(messageDiv) displayMessage('registration-message', 'Page setup error. Please contact support.', 'error');
        return;
    }

    if (registerButton) {
        registerButton.addEventListener('click', async function(event) {
            event.preventDefault(); // Prevent default form submission if it were a form
            clearMessage('registration-message');

            const fullName = fullNameInput.value.trim();
            const email = emailInput.value.trim();
            const password = passwordInput.value;
            const confirmPassword = confirmPasswordInput.value;

            if (!fullName || !email || !password || !confirmPassword) {
                displayMessage('registration-message', 'All fields are required.', 'error');
                return;
            }

            if (password !== confirmPassword) {
                displayMessage('registration-message', 'Passwords do not match.', 'error');
                return;
            }

            // Basic email validation (very simple)
            if (!email.includes('@') || !email.includes('.')) {
                displayMessage('registration-message', 'Please enter a valid email address.', 'error');
                return;
            }
            
            if (password.length < 6) { // Example: Minimum password length
                displayMessage('registration-message', 'Password must be at least 6 characters long.', 'error');
                return;
            }

            try {
                const data = {
                    full_name: fullName,
                    email: email,
                    password: password
                };
                const response = await fetchApi('/register', 'POST', data);
                displayMessage('registration-message', response.message || 'Registration successful! Please log in.', 'success');
                
                // Clear form fields
                fullNameInput.value = '';
                emailInput.value = '';
                passwordInput.value = '';
                confirmPasswordInput.value = '';

                setTimeout(() => {
                    redirectTo('login_page.html');
                }, 2000); // Redirect after 2 seconds

            } catch (error) {
                displayMessage('registration-message', error.message || 'Registration failed. Please try again.', 'error');
            }
        });
    } else {
        console.warn('Register button not found.');
    }

    if (loginLink) {
        loginLink.addEventListener('click', function(event) {
            event.preventDefault();
            redirectTo('login_page.html');
        });
        // Make it look like a link if it's a <p> tag
        if (loginLink.tagName === 'P') {
            loginLink.style.cursor = 'pointer';
            loginLink.style.textDecoration = 'underline';
        }
    } else {
        console.warn('Login link not found.');
    }
});
