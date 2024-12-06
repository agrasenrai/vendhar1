document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    
    const LOGIN_URL = "/register";

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('name').value.trim();
        const phone = document.getElementById('phone').value.trim();
        const email = document.getElementById('email').value.trim();

        if (!username || !phone || !email) {
            showError('Please fill in all fields');
            return;
        }

        try {
            const response = await fetch(LOGIN_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, phone, email }),
            });

            if (response.ok) {
                const data = await response.json();
                if (data.token) {
                    localStorage.setItem("authToken", data.token);
                    window.location.href = "/tickets";
                } else {
                    showError('Invalid response from server');
                }
            } else {
                const errorData = await response.json();
                showError(errorData.error || "Registration failed. Please try again.");
            }
        } catch (error) {
            console.error('Login error:', error);
            showError("Network error. Please check your connection and try again.");
        }
    });

    function showError(message) {
        const errorDiv = document.getElementById('loginError');
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 3000);
    }
});
