document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('loginError');

    // Hardcoded credentials for demo
    const VALID_CREDENTIALS = {
        username: 'admin',
        password: 'admin123'
    };

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        if (username === VALID_CREDENTIALS.username && 
            password === VALID_CREDENTIALS.password) {
            // Store login state
            sessionStorage.setItem('isLoggedIn', 'true');
            // Redirect to dashboard
            window.location.href = '/admin/dashboard';
        } else {
            errorMessage.textContent = 'Invalid username or password';
            loginForm.reset();
        }
    });

    // Check if user is already logged in
    if (sessionStorage.getItem('isLoggedIn') === 'true') {
        window.location.href = '/admin/dashboard';
    }
}); 