document.addEventListener('DOMContentLoaded', function() {
    // The landing page has two buttons that can be identified by their text or by adding IDs.
    // Assuming the buttons are the first and second button elements in a specific container,
    // or we can add IDs to them like id="register-button" and id="login-button".

    // Let's try to find them by their text content if IDs are not present.
    const buttons = document.querySelectorAll('button');
    let registerButton = null;
    let loginButton = null;

    buttons.forEach(button => {
        const buttonText = button.querySelector('span')?.textContent.trim();
        if (buttonText === 'Register') {
            registerButton = button;
        } else if (buttonText === 'Login') {
            loginButton = button;
        }
    });

    if (registerButton) {
        registerButton.addEventListener('click', function() {
            redirectTo('registration_page.html');
        });
    } else {
        console.warn('Register button not found on landing page.');
    }

    if (loginButton) {
        loginButton.addEventListener('click', function() {
            redirectTo('login_page.html');
        });
    } else {
        console.warn('Login button not found on landing page.');
    }

    // Also, check if user is already logged in. If so, redirect to feed.
    getCurrentUser().then(user => {
        if (user) {
            if (user.is_admin) {
                redirectTo('admin_dashboard.html');
            } else {
                redirectTo('main_feed.html');
            }
        }
    }).catch(error => {
        console.info('User not logged in or error fetching user:', error.message);
        // Stay on landing page if not logged in
    });
});
