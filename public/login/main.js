        const API_URL = window.location.origin;
        const spinner = document.getElementById('spinnerOverlay');

        function showSpinner() {
            spinner.classList.add('show');
        }

        function hideSpinner() {
            spinner.classList.remove('show');
        }

        function showToast(message, isSuccess = true) {
            const toast = document.createElement('div');
            toast.className = `toast-message ${isSuccess ? 'toast-success' : 'toast-error'}`;
            toast.textContent = message;
            document.body.appendChild(toast);
            setTimeout(() => {
                toast.style.animation = 'slideDown 0.3s ease forwards';
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }

        const tabs = document.querySelectorAll('.auth-tab');
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');

        tabs.forEach(tab => {
            tab.addEventListener('click', function() {
                tabs.forEach(t => t.classList.remove('active'));
                this.classList.add('active');
                if (this.dataset.tab === 'login') {
                    loginForm.classList.add('active');
                    registerForm.classList.remove('active');
                } else {
                    registerForm.classList.add('active');
                    loginForm.classList.remove('active');
                }
            });
        });

        document.getElementById('switchToRegister').addEventListener('click', function(e) {
            e.preventDefault();
            tabs.forEach(t => t.classList.remove('active'));
            document.querySelector('[data-tab="register"]').classList.add('active');
            loginForm.classList.remove('active');
            registerForm.classList.add('active');
        });

        document.getElementById('switchToLogin').addEventListener('click', function(e) {
            e.preventDefault();
            tabs.forEach(t => t.classList.remove('active'));
            document.querySelector('[data-tab="login"]').classList.add('active');
            registerForm.classList.remove('active');
            loginForm.classList.add('active');
        });

        document.querySelectorAll('.toggle-password').forEach(toggle => {
            toggle.addEventListener('click', function() {
                const targetId = this.dataset.target;
                const input = document.getElementById(targetId);
                const icon = this.querySelector('i');
                if (input.type === 'password') {
                    input.type = 'text';
                    icon.classList.remove('fa-eye');
                    icon.classList.add('fa-eye-slash');
                } else {
                    input.type = 'password';
                    icon.classList.remove('fa-eye-slash');
                    icon.classList.add('fa-eye');
                }
            });
        });

        const loginEmail = document.getElementById('loginEmail');
        const loginPassword = document.getElementById('loginPassword');
        const loginEmailError = document.getElementById('loginEmailError');
        const loginPasswordError = document.getElementById('loginPasswordError');
        const loginSuccess = document.getElementById('loginSuccess');

        document.getElementById('loginFormElement').addEventListener('submit', async function(e) {
            e.preventDefault();
            let isValid = true;
            const emailRegex = /^[^\s@]+@([^\s@]+\.)+[^\s@]+$/;

            if (!loginEmail.value || !emailRegex.test(loginEmail.value)) {
                loginEmail.classList.add('error');
                loginEmailError.classList.add('show');
                isValid = false;
            } else {
                loginEmail.classList.remove('error');
                loginEmailError.classList.remove('show');
            }

            if (!loginPassword.value || loginPassword.value.length < 6) {
                loginPassword.classList.add('error');
                loginPasswordError.classList.add('show');
                isValid = false;
            } else {
                loginPassword.classList.remove('error');
                loginPasswordError.classList.remove('show');
            }

            if (!isValid) return;

            showSpinner();
            try {
                const response = await fetch(`${API_URL}/api/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: loginEmail.value,
                        password: loginPassword.value
                    })
                });
                const data = await response.json();
                hideSpinner();

                if (data.success) {
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));
                    loginSuccess.classList.add('show');
                    setTimeout(() => {
                        window.location.href = '/';
                    }, 1500);
                } else {
                    showToast(data.error || 'Login failed', false);
                }
            } catch (error) {
                hideSpinner();
                showToast('Something went wrong. Please try again.', false);
            }
        });

        loginEmail.addEventListener('input', function() {
            const emailRegex = /^[^\s@]+@([^\s@]+\.)+[^\s@]+$/;
            if (this.value && emailRegex.test(this.value)) {
                this.classList.remove('error');
                loginEmailError.classList.remove('show');
            }
        });

        loginPassword.addEventListener('input', function() {
            if (this.value && this.value.length >= 6) {
                this.classList.remove('error');
                loginPasswordError.classList.remove('show');
            }
        });

        const registerName = document.getElementById('registerName');
        const registerEmail = document.getElementById('registerEmail');
        const registerPassword = document.getElementById('registerPassword');
        const registerPhone = document.getElementById('registerPhone');
        const registerConfirm = document.getElementById('registerConfirm');
        const registerNameError = document.getElementById('registerNameError');
        const registerEmailError = document.getElementById('registerEmailError');
        const registerPhoneError = document.getElementById('registerPhoneError');
        const registerConfirmError = document.getElementById('registerConfirmError');
        const registerSuccess = document.getElementById('registerSuccess');
        const strengthBar = document.getElementById('strengthBar');

        function validatePassword(password) {
            const length = password.length >= 8;
            const upper = /[A-Z]/.test(password);
            const lower = /[a-z]/.test(password);
            const number = /[0-9]/.test(password);

            document.getElementById('lengthCheck').className = length ? 'valid' : 'invalid';
            document.getElementById('lengthCheck').querySelector('i').className = length ? 'fas fa-check' : 'fas fa-times';
            document.getElementById('upperCheck').className = upper ? 'valid' : 'invalid';
            document.getElementById('upperCheck').querySelector('i').className = upper ? 'fas fa-check' : 'fas fa-times';
            document.getElementById('lowerCheck').className = lower ? 'valid' : 'invalid';
            document.getElementById('lowerCheck').querySelector('i').className = lower ? 'fas fa-check' : 'fas fa-times';
            document.getElementById('numberCheck').className = number ? 'valid' : 'invalid';
            document.getElementById('numberCheck').querySelector('i').className = number ? 'fas fa-check' : 'fas fa-times';

            let strength = 0;
            if (length) strength++;
            if (upper) strength++;
            if (lower) strength++;
            if (number) strength++;

            const percentage = (strength / 4) * 100;
            strengthBar.style.width = percentage + '%';
            if (strength <= 1) strengthBar.style.background = '#ef4444';
            else if (strength === 2) strengthBar.style.background = '#f59e0b';
            else if (strength === 3) strengthBar.style.background = '#3b82f6';
            else strengthBar.style.background = '#10b981';

            return { length, upper, lower, number };
        }

        registerPassword.addEventListener('input', function() {
            validatePassword(this.value);
            checkPasswordMatch();
        });

        registerConfirm.addEventListener('input', checkPasswordMatch);

        function checkPasswordMatch() {
            if (registerConfirm.value && registerConfirm.value !== registerPassword.value) {
                registerConfirm.classList.add('error');
                registerConfirmError.classList.add('show');
            } else {
                registerConfirm.classList.remove('error');
                registerConfirmError.classList.remove('show');
            }
        }

        document.getElementById('registerFormElement').addEventListener('submit', async function(e) {
            e.preventDefault();
            let isValid = true;
            const emailRegex = /^[^\s@]+@([^\s@]+\.)+[^\s@]+$/;
            const phoneRegex = /^[0-9]{10,11}$/;

            if (!registerName.value || registerName.value.length < 2) {
                registerName.classList.add('error');
                registerNameError.classList.add('show');
                isValid = false;
            } else {
                registerName.classList.remove('error');
                registerNameError.classList.remove('show');
            }

            if (!registerEmail.value || !emailRegex.test(registerEmail.value)) {
                registerEmail.classList.add('error');
                registerEmailError.classList.add('show');
                isValid = false;
            } else {
                registerEmail.classList.remove('error');
                registerEmailError.classList.remove('show');
            }

            if (registerPhone.value && !phoneRegex.test(registerPhone.value.replace(/[^0-9]/g, ''))) {
                registerPhone.classList.add('error');
                registerPhoneError.classList.add('show');
                isValid = false;
            } else {
                registerPhone.classList.remove('error');
                registerPhoneError.classList.remove('show');
            }

            const validation = validatePassword(registerPassword.value);
            if (!validation.length || !validation.upper || !validation.lower || !validation.number) {
                isValid = false;
            }

            if (registerConfirm.value !== registerPassword.value || !registerConfirm.value) {
                registerConfirm.classList.add('error');
                registerConfirmError.classList.add('show');
                isValid = false;
            } else {
                registerConfirm.classList.remove('error');
                registerConfirmError.classList.remove('show');
            }

            if (!isValid) return;

            showSpinner();
            try {
                const response = await fetch(`${API_URL}/api/auth/signup`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: registerEmail.value,
                        password: registerPassword.value,
                        username: registerName.value,
                        phone: registerPhone.value || ''
                    })
                });
                const data = await response.json();
                hideSpinner();

                if (data.success) {
                    registerSuccess.classList.add('show');
                    setTimeout(() => {
                        window.location.href = '/login';
                    }, 2000);
                } else {
                    showToast(data.error || 'Registration failed', false);
                }
            } catch (error) {
                hideSpinner();
                showToast('Something went wrong. Please try again.', false);
            }
        });

        registerName.addEventListener('input', function() {
            if (this.value && this.value.length >= 2) {
                this.classList.remove('error');
                registerNameError.classList.remove('show');
            }
        });

        registerEmail.addEventListener('input', function() {
            const emailRegex = /^[^\s@]+@([^\s@]+\.)+[^\s@]+$/;
            if (this.value && emailRegex.test(this.value)) {
                this.classList.remove('error');
                registerEmailError.classList.remove('show');
            }
        });

        registerPhone.addEventListener('input', function() {
            const phoneRegex = /^[0-9]{10,11}$/;
            const cleanNumber = this.value.replace(/[^0-9]/g, '');
            if (cleanNumber && phoneRegex.test(cleanNumber)) {
                this.classList.remove('error');
                registerPhoneError.classList.remove('show');
            }
        });

        // ========== GOOGLE LOGIN ==========
        document.getElementById('googleLogin').addEventListener('click', function() {
            showToast('Redirecting to Google...', true);
            setTimeout(() => {
                window.location.href = '/api/auth/google';
            }, 500);
        });

        // ========== GOOGLE REGISTER ==========
        document.getElementById('googleRegisterBtn').addEventListener('click', function() {
            showToast('Redirecting to Google...', true);
            setTimeout(() => {
                window.location.href = '/api/auth/google';
            }, 500);
        });

        // ========== CHECK FOR TOKEN IN URL (After Google Redirect) ==========
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        if (token) {
            localStorage.setItem('token', token);
            showToast('Google login successful! Redirecting...', true);
            setTimeout(() => {
                window.location.href = '/';
            }, 1000);
        }

        // ========== FACEBOOK PLACEHOLDER ==========
        document.getElementById('facebookLogin').addEventListener('click', function() {
            showToast('Facebook login coming soon!', false);
        });

        document.getElementById('facebookRegisterBtn').addEventListener('click', function() {
            showToast('Facebook sign up coming soon!', false);
        });

        document.querySelector('.forgot-link').addEventListener('click', function(e) {
            e.preventDefault();
            showToast('Password reset feature coming soon!', false);
        });

        // ========== REDIRECT IF ALREADY LOGGED IN ==========
        if (localStorage.getItem('token')) {
            window.location.href = '/';
        }