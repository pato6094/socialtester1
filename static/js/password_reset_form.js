document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('password-reset-form');
    const newPasswordInput = document.getElementById('new-password');
    const confirmPasswordInput = document.getElementById('confirm-password');
    const tokenInput = document.getElementById('reset-token'); // Hidden input
    const messageDiv = document.getElementById('reset-form-message');

    if (!form || !newPasswordInput || !confirmPasswordInput || !tokenInput || !messageDiv) {
        console.error('Required elements not found on password_reset_form.html.');
        if(messageDiv) displayMessage('reset-form-message', 'Page setup error. Please contact support.', 'error');
        return;
    }

    // Extract token from URL query parameters
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');

    if (tokenFromUrl) {
        tokenInput.value = tokenFromUrl;
    } else {
        displayMessage('reset-form-message', 'Password reset token not found in URL. Please request a new reset link.', 'error');
        form.querySelector('button[type="submit"]').disabled = true; // Disable form submission
    }

    form.addEventListener('submit', async function(event) {
        event.preventDefault();
        clearMessage('reset-form-message');

        const token = tokenInput.value;
        const newPassword = newPasswordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        if (!token) {
            displayMessage('reset-form-message', 'Missing password reset token. Please request a new reset link.', 'error');
            return;
        }
        if (!newPassword || !confirmPassword) {
            displayMessage('reset-form-message', 'Both password fields are required.', 'error');
            return;
        }
        if (newPassword !== confirmPassword) {
            displayMessage('reset-form-message', 'Passwords do not match.', 'error');
            return;
        }
        if (newPassword.length < 6) { // Example: Minimum password length
            displayMessage('reset-form-message', 'Password must be at least 6 characters long.', 'error');
            return;
        }

        try {
            const response = await fetchApi('/reset-password', 'POST', {
                token: token,
                new_password: newPassword
            });
            displayMessage('reset-form-message', response.message || 'Password has been reset successfully! You can now log in.', 'success');
            
            // Clear form fields
            newPasswordInput.value = '';
            confirmPasswordInput.value = '';
            
            setTimeout(() => {
                redirectTo('login_page.html');
            }, 3000); // Redirect after 3 seconds

        } catch (error) {
            displayMessage('reset-form-message', error.message || 'Failed to reset password. The token might be invalid or expired.', 'error');
        }
    });
});
