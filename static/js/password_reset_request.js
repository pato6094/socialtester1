document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('password-reset-request-form');
    const emailInput = document.getElementById('email');
    const messageDiv = document.getElementById('reset-request-message');

    if (!form || !emailInput || !messageDiv) {
        console.error('Required elements (form, email input, or message div) not found on password_reset_request.html.');
        if (messageDiv) displayMessage('reset-request-message', 'Page setup error. Please contact support.', 'error');
        return;
    }

    form.addEventListener('submit', async function(event) {
        event.preventDefault();
        clearMessage('reset-request-message');

        const email = emailInput.value.trim();
        if (!email) {
            displayMessage('reset-request-message', 'Email address is required.', 'error');
            return;
        }

        // Basic email validation
        if (!email.includes('@') || !email.includes('.')) {
            displayMessage('reset-request-message', 'Please enter a valid email address.', 'error');
            return;
        }

        try {
            const response = await fetchApi('/request-password-reset', 'POST', { email });
            // For this exercise, we display the token directly as we are not sending emails.
            // In a real app, this message would just confirm that an email has been sent if the user exists.
            let successMessage = "If an account with this email exists, a password reset token has been generated. ";
            if (response.reset_token) {
                successMessage += `For testing purposes, your token is: ${response.reset_token}. Please go to password_reset_form.html?token=${response.reset_token}`;
            } else {
                 successMessage += "Please check your email (simulation - no email sent).";
            }
            displayMessage('reset-request-message', successMessage, 'success');
            emailInput.value = ''; // Clear the input field
        } catch (error) {
            // The API might return 404 if user not found, or other errors.
            // It's often better practice not to reveal if an email is registered or not for security reasons.
            // So, a generic message is usually preferred in production.
            // For this exercise, we can display the specific error.
            displayMessage('reset-request-message', error.message || 'Failed to request password reset. Please try again.', 'error');
        }
    });
});
