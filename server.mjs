                function switchAuthTab(mode) {
          alert("Button tapped! Mode: " + mode); // Temporary test alert
          const loginBtn = document.getElementById('loginTabBtn');
          const signupBtn = document.getElementById('signupTabBtn');
          const loginForm = document.getElementById('loginForm');
          const signupForm = document.getElementById('signupForm');

          if (mode === 'login') {
            loginBtn.style.background = '#2563eb';
            loginBtn.style.color = '#fff';
            loginBtn.style.borderColor = '#2563eb';
            signupBtn.style.background = '#0f172a';
            signupBtn.style.color = '#94a3b8';
            signupBtn.style.borderColor = '#334155';
            loginForm.style.display = 'block';
            signupForm.style.display = 'none';
          } else {
            signupBtn.style.background = '#2563eb';
            signupBtn.style.color = '#fff';
            signupBtn.style.borderColor = '#2563eb';
            loginBtn.style.background = '#0f172a';
            loginBtn.style.color = '#94a3b8';
            loginBtn.style.borderColor = '#334155';
            signupForm.style.display = 'block';
            loginForm.style.display = 'none';
          }
        }
