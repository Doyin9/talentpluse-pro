 import fs from 'fs';
import express from 'express';

const app = express();
app.use(express.json());

const USERS_FILE = './users.json';

function getUsers() {
  if (!fs.existsSync(USERS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  } catch (e) {
    return [];
  }
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

app.post('/api/signup', (req, res) => {
  const { firstName, middleName, username, email, password } = req.body;
  if (!firstName || !username || !email || !password) {
    return res.json({ success: false, message: 'Please fill in all required fields.' });
  }

  const users = getUsers();
  if (users.find(u => u.username === username || u.email === email)) {
    return res.json({ success: false, message: 'Username or Email already exists.' });
  }

  users.push({ firstName, middleName, username, email, password });
  saveUsers(users);
  res.json({ success: true });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const users = getUsers();
  const user = users.find(u => (u.username === username || u.email === username) && u.password === password);
  if (user) {
    res.json({ success: true, user });
  } else {
    res.json({ success: false, message: 'Invalid credentials' });
  }
});

app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TalentPulse PRO</title>
  <style>
    body { font-family: Arial, sans-serif; background: #0f172a; color: #fff; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
    .card { background: #1e293b; padding: 25px; border-radius: 12px; width: 100%; max-width: 400px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3); }
    h2 { text-align: center; margin-bottom: 20px; color: #38bdf8; }
    .tabs { display: flex; margin-bottom: 20px; border-bottom: 2px solid #334155; }
    .tab-btn { flex: 1; padding: 10px; background: none; border: none; color: #94a3b8; font-size: 16px; font-weight: bold; cursor: pointer; }
    .tab-btn.active { color: #fff; border-bottom: 2px solid #38bdf8; }
    input { width: 100%; padding: 10px; margin-bottom: 12px; background: #0f172a; border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box; }
    .submit-btn { width: 100%; padding: 10px; background: #2563eb; color: #fff; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; }
  </style>
</head>
<body>
  <div class="card">
    <h2>TalentPulse PRO</h2>
    <div class="tabs">
      <button id="loginTabBtn" class="tab-btn active" onclick="switchAuthTab('login')">Login</button>
      <button id="signupTabBtn" class="tab-btn" onclick="switchAuthTab('signup')">Sign Up</button>
    </div>

    <!-- Login Form -->
    <form id="loginForm" onsubmit="handleLogin(event)">
      <input type="text" id="loginUsername" placeholder="Username or Email" required>
      <input type="password" id="loginPassword" placeholder="Password" required>
      <button type="submit" class="submit-btn">Login</button>
      <p id="loginError" style="color: #ef4444; font-size: 12px; display: none; text-align: center; margin-top: 10px;"></p>
    </form>

    <!-- Signup Form -->
    <form id="signupForm" style="display: none;" onsubmit="handleSignup(event)">
      <input type="text" id="signupFirstName" placeholder="First Name" required>
      <input type="text" id="signupMiddleName" placeholder="Middle Name (Optional)">
      <input type="text" id="signupUsername" placeholder="Username" required>
      <input type="email" id="signupEmail" placeholder="Email Address" required>
      <input type="password" id="signupPassword" placeholder="Password" required>
      <button type="submit" class="submit-btn">Create Account</button>
      <p id="signupError" style="color: #ef4444; font-size: 12px; display: none; text-align: center; margin-top: 10px;"></p>
    </form>
  </div>

  <script>
    function switchAuthTab(mode) {
      const loginBtn = document.getElementById('loginTabBtn');
      const signupBtn = document.getElementById('signupTabBtn');
      const loginForm = document.getElementById('loginForm');
      const signupForm = document.getElementById('signupForm');

      if (mode === 'login') {
        loginBtn.classList.add('active');
        signupBtn.classList.remove('active');
        loginForm.style.display = 'block';
        signupForm.style.display = 'none';
      } else {
        signupBtn.classList.add('active');
        loginBtn.classList.remove('active');
        signupForm.style.display = 'block';
        loginForm.style.display = 'none';
      }
    }

    async function handleLogin(e) {
      e.preventDefault();
      const username = document.getElementById('loginUsername').value;
      const password = document.getElementById('loginPassword').value;

      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (data.success) {
        alert('Login successful!');
      } else {
        const errEl = document.getElementById('loginError');
        errEl.innerText = data.message || 'Login failed';
        errEl.style.display = 'block';
      }
    }

    async function handleSignup(e) {
      e.preventDefault();
      const firstName = document.getElementById('signupFirstName').value;
      const middleName = document.getElementById('signupMiddleName').value;
      const username = document.getElementById('signupUsername').value;
      const email = document.getElementById('signupEmail').value;
      const password = document.getElementById('signupPassword').value;

      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, middleName, username, email, password })
      });

      const data = await res.json();

      if (data.success) {
        alert('Account created successfully! Please login.');
        switchAuthTab('login');
      } else {
        const errEl = document.getElementById('signupError');
        errEl.innerText = data.message || 'Signup failed';
        errEl.style.display = 'block';
      }
    }
  </script>
</body>
</html>`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(\`Server running on port \${PORT}\`));
                                              
