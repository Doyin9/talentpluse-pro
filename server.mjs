import express from 'express';
import session from 'express-session';
import bcrypt from 'bcryptjs';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const PORT = process.env.PORT || 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USERS_FILE = path.join(__dirname, 'users.json');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'change-this-secret-before-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

async function getUsers() {
  try {
    return JSON.parse(await fs.readFile(USERS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

async function saveUsers(users) {
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
}

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({
      message: 'Please log in first.'
    });
  }
  next();
}

app.get('/', (req, res) => {
  res.type('html').send(page);
});

app.post('/api/signup', async (req, res) => {
  try {
    const surname = clean(req.body.surname);
    const firstName = clean(req.body.firstName);
    const lastName = clean(req.body.lastName);
    const username = clean(req.body.username);
    const email = clean(req.body.email).toLowerCase();
    const password = req.body.password;
    const confirmPassword = req.body.confirmPassword;

    if (!surname || !firstName || !lastName ||
        !username || !email || !password) {
      return res.status(400).json({
        message: 'Please fill in every field.'
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        message: 'Enter a valid email address.'
      });
    }

    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({
        message: 'Password must contain at least 8 characters.'
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        message: 'Passwords do not match.'
      });
    }

    const users = await getUsers();

    if (users.some(u =>
      u.username.toLowerCase() === username.toLowerCase()
    )) {
      return res.status(409).json({
        message: 'That username is already registered.'
      });
    }

    if (users.some(u => u.email === email)) {
      return res.status(409).json({
        message: 'That email is already registered.'
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    users.push({
      id: Date.now().toString(),
      surname,
      firstName,
      lastName,
      username,
      email,
      passwordHash
    });

    await saveUsers(users);

    res.status(201).json({
      message: 'Account created successfully. Please log in.'
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      message: 'Could not create your account. Please try again.'
    });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const username = clean(req.body.username);
    const password = req.body.password;

    if (!username || typeof password !== 'string' || !password) {
      return res.status(400).json({
        message: 'Enter your username and password.'
      });
    }

    const users = await getUsers();

    const user = users.find(u =>
      u.username.toLowerCase() === username.toLowerCase()
    );

    if (!user || !await bcrypt.compare(password, user.passwordHash)) {
      return res.status(401).json({
        message: 'Incorrect username or password.'
      });
    }

    req.session.regenerate(error => {
      if (error) {
        return res.status(500).json({
          message: 'Could not start your session.'
        });
      }

      req.session.user = {
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        surname: user.surname
      };

      req.session.save(error => {
        if (error) {
          return res.status(500).json({
            message: 'Could not save your login session.'
          });
        }

        res.json({ message: 'Login successful.' });
      });
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      message: 'Login failed. Please try again.'
    });
  }
});

app.get('/api/me', requireLogin, (req, res) => {
  res.json({ user: req.session.user });
});

app.post('/api/logout', requireLogin, (req, res) => {
  req.session.destroy(error => {
    if (error) {
      return res.status(500).json({
        message: 'Could not log out.'
      });
    }

    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out successfully.' });
  });
});

const jobs = [
  {
    title: 'Graduate Trainee',
    company: 'CareerStart Nigeria',
    location: 'Lagos',
    type: 'Full-time',
    description: 'An entry-level opportunity for recent graduates.'
  },
  {
    title: 'Customer Service Officer',
    company: 'PeopleFirst Services',
    location: 'Abuja',
    type: 'Full-time',
    description: 'Help customers and resolve enquiries.'
  },
  {
    title: 'Junior Web Developer',
    company: 'DigitalWorks',
    location: 'Remote',
    type: 'Remote',
    description: 'Assist with website development and maintenance.'
  },
  {
    title: 'Administrative Assistant',
    company: 'OfficePoint',
    location: 'Ibadan',
    type: 'Part-time',
    description: 'Support daily administrative operations.'
  }
];

app.get('/api/jobs', requireLogin, (req, res) => {
  const search = clean(req.query.search).toLowerCase();
  const location = clean(req.query.location).toLowerCase();
  const type = clean(req.query.type).toLowerCase();

  const filtered = jobs.filter(job =>
    (!search ||
      `${job.title} ${job.company} ${job.description}`
        .toLowerCase().includes(search)) &&
    (!location || job.location.toLowerCase().includes(location)) &&
    (!type || job.type.toLowerCase() === type)
  );

  res.json({ jobs: filtered });
});

app.post('/api/applicants', requireLogin, (req, res) => {
  const fullName = clean(req.body.fullName);
  const phone = clean(req.body.phone);
  const education = clean(req.body.education);
  const jobTitle = clean(req.body.jobTitle);

  if (!fullName || !phone || !education || !jobTitle) {
    return res.status(400).json({
      message: 'Please complete every applicant field.'
    });
  }

  res.status(201).json({
    message: 'Your applicant form has been received.'
  });
});

const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>TalentPulse PRO</title>
<style>
*{box-sizing:border-box}
body{margin:0;font-family:Arial,sans-serif;background:#f2f5fb;color:#18243b}
header{background:#10284b;color:white;padding:20px;text-align:center}
main{max-width:900px;margin:25px auto;padding:18px}
.card{background:white;padding:24px;border-radius:14px;box-shadow:0 4px 18px #0001;margin-bottom:20px}
.tabs{display:flex;gap:10px;margin-bottom:20px}
button{cursor:pointer;border:0;border-radius:7px;padding:12px 17px;background:#185adb;color:white}
.tabs button{flex:1;background:#e5ebf6;color:#10284b}
.tabs button.active{background:#185adb;color:white}
input,select{width:100%;padding:12px;margin:7px 0 14px;border:1px solid #ccd4e2;border-radius:7px}
label{font-size:14px;font-weight:bold}
.hidden{display:none!important}
.job{border:1px solid #e1e7f0;padding:15px;border-radius:9px;margin:12px 0}
.notice{margin:12px 0;padding:12px;border-radius:7px;background:#edf4ff}
.row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media(max-width:600px){.row{grid-template-columns:1fr}}
</style>
</head>
<body>
<header>
  <h1>TalentPulse PRO</h1>
  <p>Discover opportunities. Build your future.</p>
</header>

<main>
<section id="authView" class="card">
  <div class="tabs">
    <button id="loginTab" class="active" type="button">Login</button>
    <button id="signupTab" type="button">Sign Up</button>
  </div>

  <form id="loginForm">
    <h2>Welcome Back</h2>
    <label>Username</label>
    <input name="username" required autocomplete="username">
    <label>Password</label>
    <input name="password" type="password" required autocomplete="current-password">
    <button type="submit">Login</button>
  </form>

  <form id="signupForm" class="hidden">
    <h2>Create Your Account</h2>
    <div class="row">
      <div><label>Surname</label><input name="surname" required autocomplete="family-name"></div>
      <div><label>First Name</label><input name="firstName" required autocomplete="given-name"></div>
    </div>
    <label>Last Name</label>
    <input name="lastName" required>
    <label>Username</label>
    <input name="username" required minlength="3" autocomplete="username">
    <label>Email Address</label>
    <input name="email" type="email" required autocomplete="email">
    <label>Password (at least 8 characters)</label>
    <input name="password" type="password" minlength="8" required autocomplete="new-password">
    <label>Confirm Password</label>
    <input name="confirmPassword" type="password" minlength="8" required autocomplete="new-password">
    <button type="submit">Create Account</button>
  </form>
  <p id="authMessage" class="notice hidden" role="status"></p>
</section>

<section id="dashboardView" class="hidden">
  <div class="card">
    <h2 id="welcome"></h2>
    <p>Search available opportunities and complete your applicant form.</p>
    <button id="logoutBtn" type="button">Logout</button>
  </div>

  <div class="card">
    <h2>Find Jobs</h2>
    <form id="jobSearchForm">
      <label>Job title or keyword</label>
      <input name="search" placeholder="e.g. developer">
      <label>Location</label>
      <input name="location" placeholder="e.g. Lagos or Remote">
      <label>Job type</label>
      <select name="type">
        <option value="">All types</option>
        <option>Full-time</option>
        <option>Part-time</option>
        <option>Remote</option>
      </select>
      <button type="submit">Search Jobs</button>
    </form>
    <div id="jobsList"></div>
  </div>

  <div class="card">
    <h2>Applicant Registration</h2>
    <form id="applicantForm">
      <label>Full Name</label><input name="fullName" required>
      <label>Phone Number</label><input name="phone" type="tel" required>
      <label>Highest Education</label>
      <input name="education" required placeholder="e.g. B.Sc. or OND">
      <label>Job Title Applying For</label><input name="jobTitle" required>
      <button type="submit">Submit Application Details</button>
    </form>
    <p id="applicantMessage" class="notice hidden" role="status"></p>
  </div>
</section>
</main>

<script>
const $ = id => document.getElementById(id);
let currentUser = null;

function showMessage(id, message) {
  const element = $(id);
  element.textContent = message;
  element.classList.remove('hidden');
}

function showAuth(mode) {
  const signup = mode === 'signup';
  $('loginForm').classList.toggle('hidden', signup);
  $('signupForm').classList.toggle('hidden', !signup);
  $('loginTab').classList.toggle('active', !signup);
  $('signupTab').classList.toggle('active', signup);
  $('authMessage').classList.add('hidden');
}

$('loginTab').addEventListener('click', () => showAuth('login'));
$('signupTab').addEventListener('click', () => showAuth('signup'));

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Request failed.');
  return data;
}

$('signupForm').addEventListener('submit', async event => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const data = Object.fromEntries(form.entries());

  try {
    const result = await api('/api/signup', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    showMessage('authMessage', result.message);
    event.currentTarget.reset();
    showAuth('login');
    showMessage('authMessage', result.message);
  } catch (error) {
    showMessage('authMessage', error.message);
  }
});

$('loginForm').addEventListener('submit', async event => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget).entries());

  try {
    await api('/api/login', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    await loadDashboard();
  } catch (error) {
    showMessage('authMessage', error.message);
  }
});

async function loadDashboard() {
  const result = await api('/api/me');
  currentUser = result.user;
  $('authView').classList.add('hidden');
  $('dashboardView').classList.remove('hidden');
  $('welcome').textContent = 'Welcome, ' + currentUser.firstName + '!';
  await loadJobs();
}

async function loadJobs(filters = {}) {
  const params = new URLSearchParams(filters);
  const result = await api('/api/jobs?' + params.toString());
  const list = $('jobsList');
  list.replaceChildren();

  if (!result.jobs.length) {
    list.textContent = 'No jobs match your search.';
    return;
  }

  result.jobs.forEach(job => {
    const card = document.createElement('article');
    card.className = 'job';

    const title = document.createElement('h3');
    title.textContent = job.title;

    const company = document.createElement('p');
    company.textContent = job.company + ' • ' + job.location + ' • ' + job.type;

    const description = document.createElement('p');
    description.textContent = job.description;

    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Apply for this Job';
    button.addEventListener('click', () => {
      $('applicantForm').elements.jobTitle.value = job.title;
      $('applicantForm').scrollIntoView({ behavior: 'smooth' });
    });

    card.append(title, company, description, button);
    list.append(card);
  });
}

$('jobSearchForm').addEventListener('submit', async event => {
  event.preventDefault();
  const filters = Object.fromEntries(new FormData(event.currentTarget).entries());

  try {
    await loadJobs(filters);
  } catch (error) {
    alert(error.message);
  }
});

$('applicantForm').addEventListener('submit', async event => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget).entries());

  try {
    const result = await api('/api/applicants', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    showMessage('applicantMessage', result.message);
  } catch (error) {
    showMessage('applicantMessage', error.message);
  }
});

$('logoutBtn').addEventListener('click', async () => {
  try {
    await api('/api/logout', { method: 'POST', body: '{}' });
    currentUser = null;
    $('dashboardView').classList.add('hidden');
    $('authView').classList.remove('hidden');
    $('loginForm').reset();
    showAuth('login');
  } catch (error) {
    alert(error.message);
  }
});

(async () => {
  try {
    await loadDashboard();
  } catch {
    $('authView').classList.remove('hidden');
    $('dashboardView').classList.add('hidden');
  }
})();
</script>
</body>
</html>`;

app.listen(PORT, () => {
  console.log('TalentPulse PRO running on port ' + PORT);
});
