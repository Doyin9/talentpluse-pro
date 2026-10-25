import express from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import bcrypt from 'bcryptjs';
import pg from 'pg';
const { Pool } = pg;
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const PORT = process.env.PORT || 3000;
app.set('trust proxy', 1);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const PgSession = connectPgSimple(session);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  store: new PgSession({
    pool: pool,
    tableName: 'session',
    createTableIfMissing: true
  }),
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

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      surname TEXT NOT NULL,
      "firstName" TEXT NOT NULL,
      "lastName" TEXT NOT NULL,
      username TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      "passwordHash" TEXT NOT NULL
    )
  `);
}

async function getUsers() {
  const result = await pool.query('SELECT * FROM users');
  return result.rows;
}

async function saveUsers(users) {
  for (const user of users) {
    await pool.query(`
      INSERT INTO users (
        id, surname, "firstName", "lastName",
        username, email, "passwordHash"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (id) DO UPDATE SET
        surname = EXCLUDED.surname,
        "firstName" = EXCLUDED."firstName",
        "lastName" = EXCLUDED."lastName",
        username = EXCLUDED.username,
        email = EXCLUDED.email,
        "passwordHash" = EXCLUDED."passwordHash"
    `, [
      user.id,
      user.surname,
      user.firstName,
      user.lastName,
      user.username,
      user.email,
      user.passwordHash
    ]);
  }
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
    const email = clean(req.body.email).toLowerCase();
    const password = req.body.password;

    if (!email || typeof password !== 'string' || !password) {
      return res.status(400).json({
        message: 'Enter your email address and password.'
      });
    }

    const users = await getUsers();

    const user = users.find(u =>
      typeof u.email === 'string' &&
      u.email.toLowerCase() === email
    );

    if (!user || !await bcrypt.compare(password, user.passwordHash)) {
      return res.status(401).json({
        message: 'Incorrect email or password.'
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
        email: user.email,
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
    description: 'An entry-level opportunity for recent graduates.',
    details: 'This role offers rotations across business operational units, mentorship, soft-skills workshops, and fast-track career progression opportunities.'
  },
  {
    title: 'Customer Service Officer',
    company: 'PeopleFirst Services',
    location: 'Abuja',
    type: 'Full-time',
    description: 'Help customers and resolve enquiries.',
    details: 'Responsibilities include taking inbound calls, managing customer queries via email and chat, handling complaint resolution, and maintaining account records.'
  },
  {
    title: 'Junior Web Developer',
    company: 'DigitalWorks',
    location: 'Remote',
    type: 'Remote',
    description: 'Assist with website development and maintenance.',
    details: 'Requires basic knowledge of HTML/CSS, JavaScript, and responsive layout building. You will collaborate with senior developers on real production web apps.'
  },
  {
    title: 'Administrative Assistant',
    company: 'OfficePoint',
    location: 'Ibadan',
    type: 'Part-time',
    description: 'Support daily administrative operations.',
    details: 'Responsible for scheduling meetings, organizing office documents, managing office supply inventory, and writing weekly administrative reports.'
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
.card{background:white;padding:24px;border-radius:14px;box-shadow:0 4px 18px #0001;margin-bottom:20px;position:relative}
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
.job-details-box{background:#f8fafc;padding:15px;border-left:4px solid #185adb;border-radius:6px;margin-bottom:15px}

.menu-container{position:absolute;top:20px;left:20px}
.menu-btn{background:none;border:none;font-size:24px;cursor:pointer;color:#10284b;padding:0;line-height:1}
.dropdown-menu{position:absolute;top:35px;left:0;background:white;box-shadow:0 4px 15px rgba(0,0,0,0.15);border-radius:8px;width:200px;z-index:100;overflow:hidden}
.dropdown-menu button{width:100%;text-align:left;background:none;color:#18243b;padding:12px 16px;border-radius:0;border-bottom:1px solid #f1f5f9}
.dropdown-menu button:hover{background:#f8fafc}
.dropdown-menu button.logout-item{color:#dc2626;font-weight:bold}

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
  <div class="tabs hidden">
    <button id="loginTab" type="button">Login</button>
    <button id="signupTab" type="button">Sign Up</button>
  </div>
  <form id="loginForm" class="hidden">
    <h2>Welcome Back</h2>
    <label>Email Address</label>
    <input name="email" type="email" required autocomplete="email">
    <label>Password</label>
    <input name="password" type="password" required autocomplete="current-password">
    <button type="submit">Login</button>
  </form>

  <form id="signupForm">
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
    <button type="button" id="existingLoginBtn" style="background:none;border:none;color:#4f46e5;font-size:12px;padding:5px;cursor:pointer;">Already registered? Login</button>
  </form>
  <p id="authMessage" class="notice hidden" role="status"></p>
</section>

<section id="dashboardView" class="hidden">
  <div class="card" style="padding-top:50px;">
    <div class="menu-container">
      <button id="menuBtn" class="menu-btn" type="button" aria-label="Menu">☰</button>
      <div id="dropdownMenu" class="dropdown-menu hidden">
        <button type="button" id="menuMyApplications">My Applications</button>
        <button type="button" id="menuSavedJobs">Saved Jobs</button>
        <button type="button" id="menuProfile">Profile Settings</button>
        <button type="button" id="menuPassword">Change Password</button>
        <button type="button" id="logoutBtn" class="logout-item">Logout</button>
      </div>
    </div>

    <h2 id="welcome"></h2>
    <p style="color: #4a5568; margin-top: 6px; font-size: 15px;">A place to grow skills, elevate talent, and build your future.</p>
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
  </div>

  <div class="card">
    <h2 id="jobCountHeader">Job Listings</h2>
    <div id="jobsList"></div>
  </div>

  <div class="card hidden" id="applicationSection">
    <h2>Job Application</h2>
    <div id="selectedJobOverview" class="job-details-box"></div>

    <form id="applicantForm">
      <label>Full Name</label><input name="fullName" required>
      <label>Phone Number</label><input name="phone" type="tel" required>
      <label>Highest Education</label>
      <input name="education" required placeholder="e.g. B.Sc. or OND">
      <label>Job Title Applying For</label><input name="jobTitle" id="applicantJobTitleInput" required readonly style="background:#f1f5f9;">
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

$('existingLoginBtn').addEventListener('click', () => {
  showAuth('login');
});
$('loginTab').addEventListener('click', () => showAuth('login'));
$('signupTab').addEventListener('click', () => showAuth('signup'));

$('menuBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  $('dropdownMenu').classList.toggle('hidden');
});

document.addEventListener('click', () => {
  $('dropdownMenu').classList.add('hidden');
});

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

  $('jobCountHeader').textContent = 'Job Listings (' + result.jobs.length + ' Available)';

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
      $('applicationSection').classList.remove('hidden');
      $('selectedJobOverview').innerHTML = '<h3>Applying for: ' + job.title + '</h3>' +
        '<p><strong>Company:</strong> ' + job.company + ' (' + job.location + ' - ' + job.type + ')</p>' +
        '<p><strong>Role Overview:</strong> ' + job.description + '</p>' +
        '<p><strong>What This Job Entails:</strong> ' + job.details + '</p>';
      $('applicantJobTitleInput').value = job.title;
      $('applicationSection').scrollIntoView({ behavior: 'smooth' });
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

$('menuMyApplications').addEventListener('click', () => alert('My Applications feature coming soon!'));
$('menuSavedJobs').addEventListener('click', () => alert('Saved Jobs feature coming soon!'));
$('menuProfile').addEventListener('click', () => alert('Profile Settings feature coming soon!'));
$('menuPassword').addEventListener('click', () => alert('Change Password feature coming soon!'));

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

initDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log('TalentPulse PRO running on port ' + PORT);
    });
  })
  .catch(error => {
    console.error('Database initialization failed:', error);
    process.exit(1);
  });
