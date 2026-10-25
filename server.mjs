import express from 'express';
import session from 'express-session';
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

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(session({
  secret: 'talentpulse-secret-key',
  resave: true,
  saveUninitialized: true,
  cookie: {
    httpOnly: false,
    secure: false,
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
      "passwordHash" TEXT NOT NULL,
      headline TEXT DEFAULT '',
      bio TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      location TEXT DEFAULT '',
      avatar TEXT DEFAULT '',
      verified BOOLEAN DEFAULT false
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS applications (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      education TEXT NOT NULL,
      job_title TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS saved_jobs (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      job_title TEXT NOT NULL,
      company TEXT NOT NULL,
      location TEXT NOT NULL,
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      details TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function getUsers() {
  const result = await pool.query('SELECT * FROM users');
  return result.rows;
}

function requireLogin(req, res, next) {
  if (!req.session || !req.session.user || !req.session.user.id) {
    return res.status(401).json({ message: 'Please log in first.' });
  }
  next();
}

app.get('/api/me', async (req, res) => {
  try {
    if (!req.session || !req.session.user || !req.session.user.id) {
      return res.status(401).json({ message: 'Not logged in.' });
    }
    const result = await pool.query('SELECT id, surname, "firstName", "lastName", username, email, headline, bio, phone, location, avatar, verified FROM users WHERE id = $1', [req.session.user.id]);
    if (!result.rows[0]) {
      req.session.destroy(() => {});
      return res.status(401).json({ message: 'Please log in again.' });
    }
    res.json({ user: result.rows[0] });
  } catch (error) {
    return res.status(401).json({ message: 'Please log in.' });
  }
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

    if (!surname || !firstName || !lastName || !username || !email || !password) {
      return res.status(400).json({ message: 'Please fill in every field.' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Enter a valid email address.' });
    }

    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ message: 'Password must contain at least 8 characters.' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match.' });
    }

    const users = await getUsers();

    if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
      return res.status(409).json({ message: 'That username is already registered.' });
    }

    if (users.some(u => u.email === email)) {
      return res.status(409).json({ message: 'That email is already registered.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const userId = Date.now().toString();

    await pool.query(`
      INSERT INTO users (id, surname, "firstName", "lastName", username, email, "passwordHash")
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [userId, surname, firstName, lastName, username, email, passwordHash]);

    res.status(201).json({ message: 'Account created successfully. Please log in.' });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Could not create your account. Please try again.' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const email = clean(req.body.email).toLowerCase();
    const password = req.body.password;

    if (!email || typeof password !== 'string' || !password) {
      return res.status(400).json({ message: 'Enter your email address and password.' });
    }

    const result = await pool.query('SELECT * FROM users WHERE LOWER(email) = $1', [email]);
    const user = result.rows[0];

    if (!user || !await bcrypt.compare(password, user.passwordHash)) {
      return res.status(401).json({ message: 'Incorrect email or password.' });
    }

    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      surname: user.surname,
      headline: user.headline || '',
      avatar: user.avatar || '',
      verified: user.verified || false
    };

    return res.json({ message: 'Login successful.' });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed. Please try again.' });
  }
});

app.get('/api/me', requireLogin, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, surname, "firstName", "lastName", username, email, headline, bio, phone, location, avatar, verified FROM users WHERE id = $1', [req.session.user.id]);
    if (!result.rows[0]) {
      return req.session.destroy(() => {
        res.status(401).json({ message: 'Please log in again.' });
      });
    }
    res.json({ user: result.rows[0] });
  } catch (error) {
    res.status(500).json({ message: 'Session error.' });
  }
});

app.get('/api/profile', requireLogin, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, surname, "firstName", "lastName", username, email, headline, bio, phone, location, avatar, verified FROM users WHERE id = $1', [req.session.user.id]);
    res.json({ user: result.rows[0] });
  } catch (error) {
    res.status(500).json({ message: 'Could not fetch profile.' });
  }
});

app.put('/api/profile', requireLogin, async (req, res) => {
  try {
    const firstName = clean(req.body.firstName);
    const lastName = clean(req.body.lastName);
    const surname = clean(req.body.surname);
    const username = clean(req.body.username);
    const headline = clean(req.body.headline);
    const bio = clean(req.body.bio);
    const phone = clean(req.body.phone);
    const location = clean(req.body.location);
    const avatar = req.body.avatar || '';

    if (!firstName || !lastName || !surname || !username) {
      return res.status(400).json({ message: 'First name, last name, surname, and username are required.' });
    }

    const checkUsername = await pool.query('SELECT id FROM users WHERE LOWER(username) = $1 AND id != $2', [username.toLowerCase(), req.session.user.id]);
    if (checkUsername.rows.length > 0) {
      return res.status(409).json({ message: 'That username is already taken by another account.' });
    }

    await pool.query(`
      UPDATE users SET
        "firstName" = $1,
        "lastName" = $2,
        surname = $3,
        username = $4,
        headline = $5,
        bio = $6,
        phone = $7,
        location = $8,
        avatar = $9
      WHERE id = $10
    `, [firstName, lastName, surname, username, headline, bio, phone, location, avatar, req.session.user.id]);

    req.session.user.firstName = firstName;
    req.session.user.surname = surname;

    res.json({ message: 'Profile updated successfully!', user: { firstName, surname, username, avatar } });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Could not update profile.' });
  }
});

app.post('/api/profile/verify', requireLogin, async (req, res) => {
  try {
    await pool.query('UPDATE users SET verified = true WHERE id = $1', [req.session.user.id]);
    res.json({ message: 'Account identity verified successfully!' });
  } catch (error) {
    res.status(500).json({ message: 'Verification failed.' });
  }
});

app.post('/api/logout', requireLogin, (req, res) => {
  req.session.destroy(error => {
    if (error) {
      return res.status(500).json({ message: 'Could not log out.' });
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
    (!search || `${job.title} ${job.company} ${job.description}`.toLowerCase().includes(search)) &&
    (!location || job.location.toLowerCase().includes(location)) &&
    (!type || job.type.toLowerCase() === type)
  );

  res.json({ jobs: filtered });
});

app.post('/api/applicants', requireLogin, async (req, res) => {
  try {
    const fullName = clean(req.body.fullName);
    const phone = clean(req.body.phone);
    const education = clean(req.body.education);
    const jobTitle = clean(req.body.jobTitle);

    if (!fullName || !phone || !education || !jobTitle) {
      return res.status(400).json({ message: 'Please complete every applicant field.' });
    }

    await pool.query(`
      INSERT INTO applications (user_id, full_name, phone, education, job_title)
      VALUES ($1, $2, $3, $4, $5)
    `, [req.session.user.id, fullName, phone, education, jobTitle]);

    res.status(201).json({ message: 'Your application has been submitted successfully!' });
  } catch (error) {
    console.error('Application submission error:', error);
    res.status(500).json({ message: 'Could not submit your application. Please try again.' });
  }
});

app.get('/api/applications', requireLogin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM applications WHERE user_id = $1 ORDER BY id DESC', [req.session.user.id]);
    res.json({ applications: result.rows });
  } catch (error) {
    console.error('Fetch applications error:', error);
    res.status(500).json({ message: 'Could not fetch your applications.' });
  }
});

app.post('/api/saved-jobs', requireLogin, async (req, res) => {
  try {
    const { title, company, location, type, description, details } = req.body;
    if (!title || !company) {
      return res.status(400).json({ message: 'Invalid job details.' });
    }

    const existing = await pool.query('SELECT id FROM saved_jobs WHERE user_id = $1 AND job_title = $2 AND company = $3', [req.session.user.id, title, company]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ message: 'Job is already in your saved list.' });
    }

    await pool.query(`
      INSERT INTO saved_jobs (user_id, job_title, company, location, type, description, details)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [req.session.user.id, title, company, location, type, description, details]);

    res.status(201).json({ message: 'Job saved successfully!' });
  } catch (error) {
    console.error('Save job error:', error);
    res.status(500).json({ message: 'Could not save job.' });
  }
});

app.get('/api/saved-jobs', requireLogin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM saved_jobs WHERE user_id = $1 ORDER BY id DESC', [req.session.user.id]);
    res.json({ savedJobs: result.rows });
  } catch (error) {
    console.error('Fetch saved jobs error:', error);
    res.status(500).json({ message: 'Could not fetch saved jobs.' });
  }
});

app.delete('/api/saved-jobs/:id', requireLogin, async (req, res) => {
  try {
    await pool.query('DELETE FROM saved_jobs WHERE id = $1 AND user_id = $2', [req.params.id, req.session.user.id]);
    res.json({ message: 'Job removed from saved list.' });
  } catch (error) {
    console.error('Delete saved job error:', error);
    res.status(500).json({ message: 'Could not remove saved job.' });
  }
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
input,select,textarea{width:100%;padding:12px;margin:7px 0 14px;border:1px solid #ccd4e2;border-radius:7px;font-family:inherit}
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

.avatar-wrapper{display:flex;align-items:center;gap:20px;margin-bottom:20px}
.avatar-img{width:90px;height:90px;border-radius:50%;object-fit:cover;background:#e2e8f0;border:3px solid #185adb}
.badge-verified{display:inline-block;background:#10b981;color:white;font-size:12px;padding:3px 8px;border-radius:12px;margin-left:8px}

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
    <button id="loginTab" type="button" class="active">Login</button>
    <button id="signupTab" type="button">Sign Up</button>
  </div>
  <form id="loginForm">
    <h2>Welcome Back</h2>
    <label>Email Address</label>
    <input name="email" type="email" required autocomplete="email">
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

    <div style="display:flex; align-items:center; gap:15px;">
      <img id="dashAvatar" class="avatar-img" style="width:55px; height:55px;" src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2394a3b8'><path d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/></svg>" alt="Profile">
      <div>
        <h2 id="welcome" style="margin:0;"></h2>
        <span id="verifiedBadge" class="badge-verified hidden">✓ Verified Candidate</span>
        <p style="color: #4a5568; margin-top: 4px; font-size: 14px;">A place to grow skills, elevate talent, and build your future.</p>
      </div>
    </div>
  </div>

  <div id="mainDashboardContent">
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
  </div>

  <div class="card hidden" id="myApplicationsView">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
      <h2>My Submitted Applications</h2>
      <button type="button" id="backToDashboardFromAppsBtn" style="background:#64748b;">Back to Jobs</button>
    </div>
    <div id="myApplicationsList"></div>
  </div>

  <div class="card hidden" id="savedJobsView">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
      <h2>My Saved Jobs</h2>
      <button type="button" id="backToDashboardFromSavedBtn" style="background:#64748b;">Back to Jobs</button>
    </div>
    <div id="savedJobsList"></div>
  </div>

  <div class="card hidden" id="profileView">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
      <h2>Profile Settings</h2>
      <button type="button" id="backToDashboardFromProfileBtn" style="background:#64748b;">Back to Jobs</button>
    </div>

    <div class="avatar-wrapper">
      <img id="avatarPreview" class="avatar-img" src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2394a3b8'><path d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/></svg>" alt="Preview">
      <div>
        <label for="avatarInput" style="cursor:pointer; background:#185adb; color:white; padding:8px 14px; border-radius:6px; font-size:14px; display:inline-block;">Upload Profile Picture 📷</label>
        <input type="file" id="avatarInput" accept="image/*" style="display:none;">
        <p style="font-size:12px; color:#64748b; margin-top:6px;">PNG, JPG, or GIF (max 5MB)</p>
      </div>
    </div>

    <form id="profileForm">
      <input type="hidden" id="avatarBase64" name="avatar">
      <div class="row">
        <div><label>First Name</label><input name="firstName" id="profFirstName" required></div>
        <div><label>Last Name</label><input name="lastName" id="profLastName" required></div>
      </div>

      <div class="row">
        <div><label>Surname</label><input name="surname" id="profSurname" required></div>
        <div><label>Username</label><input name="username" id="profUsername" required minlength="3"></div>
      </div>

      <label>Professional Title / Headline</label>
      <input name="headline" id="profHeadline" placeholder="e.g. Senior Software Engineer / Nursing Specialist">

      <label>Bio & Summary</label>
      <textarea name="bio" id="profBio" rows="3" placeholder="Tell recruiters about your background, skills, and goals..."></textarea>

      <div class="row">
        <div><label>Phone Number</label><input name="phone" id="profPhone" type="tel" placeholder="+234..."></div>
        <div><label>Location</label><input name="location" id="profLocation" placeholder="e.g. Lagos, Nigeria"></div>
      </div>

      <label>Email Address (Account Identifier)</label>
      <input id="profEmail" disabled style="background:#f1f5f9;">

      <button type="submit" style="width:100%; margin-top:10px;">Save Profile Changes</button>
    </form>
    <p id="profileMessage" class="notice hidden" role="status"></p>

    <hr style="margin:25px 0; border:0; border-top:1px solid #e2e8f0;">

    <div style="display:flex; justify-content:space-between; align-items:center;">
      <div>
        <h4 style="margin:0;">Account Verification</h4>
        <p style="font-size:13px; color:#64748b; margin:4px 0 0;">Verify your identity to increase recruiter trust.</p>
      </div>
      <button type="button" id="verifyAccountBtn" style="background:#059669;">Verify Candidate</button>
    </div>
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

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error('Server starting up or returned invalid response. Please try again in a moment.');
  }

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

  if (currentUser.avatar) {
    $('dashAvatar').src = currentUser.avatar;
    $('avatarPreview').src = currentUser.avatar;
    $('avatarBase64').value = currentUser.avatar;
  }

  if (currentUser.verified) {
    $('verifiedBadge').classList.remove('hidden');
  }

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

    const btnContainer = document.createElement('div');
    btnContainer.style.display = 'flex';
    btnContainer.style.gap = '10px';
    btnContainer.style.marginTop = '10px';

    const applyBtn = document.createElement('button');
    applyBtn.type = 'button';
    applyBtn.textContent = 'Apply for this Job';
    applyBtn.addEventListener('click', () => {
      $('applicationSection').classList.remove('hidden');
      $('selectedJobOverview').innerHTML = '<h3>Applying for: ' + job.title + '</h3>' +
        '<p><strong>Company:</strong> ' + job.company + ' (' + job.location + ' - ' + job.type + ')</p>' +
        '<p><strong>Role Overview:</strong> ' + job.description + '</p>' +
        '<p><strong>What This Job Entails:</strong> ' + job.details + '</p>';
      $('applicantJobTitleInput').value = job.title;
      $('applicationSection').scrollIntoView({ behavior: 'smooth' });
    });

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.textContent = 'Save Job';
    saveBtn.style.background = '#059669';
    saveBtn.addEventListener('click', async () => {
      try {
        const res = await api('/api/saved-jobs', {
          method: 'POST',
          body: JSON.stringify(job)
        });
        alert(res.message);
      } catch (err) {
        alert(err.message);
      }
    });

    btnContainer.append(applyBtn, saveBtn);
    card.append(title, company, description, btnContainer);
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
    event.currentTarget.reset();
  } catch (error) {
    showMessage('applicantMessage', error.message);
  }
});

$('menuMyApplications').addEventListener('click', async () => {
  $('mainDashboardContent').classList.add('hidden');
  $('savedJobsView').classList.add('hidden');
  $('profileView').classList.add('hidden');
  $('myApplicationsView').classList.remove('hidden');

  try {
    const result = await api('/api/applications');
    const container = $('myApplicationsList');
    container.replaceChildren();

    if (!result.applications.length) {
      container.textContent = 'You have not submitted any applications yet.';
      return;
    }

    result.applications.forEach(app => {
      const box = document.createElement('div');
      box.className = 'job';
      box.innerHTML = '<h3>' + app.job_title + '</h3>' +
        '<p><strong>Applicant Name:</strong> ' + app.full_name + '</p>' +
        '<p><strong>Phone:</strong> ' + app.phone + '</p>' +
        '<p><strong>Education:</strong> ' + app.education + '</p>' +
        '<p style="color:#64748b; font-size:13px;">Submitted on: ' + new Date(app.created_at).toLocaleString() + '</p>';
      container.append(box);
    });
  } catch (error) {
    alert(error.message);
  }
});

$('menuSavedJobs').addEventListener('click', async () => {
  $('mainDashboardContent').classList.add('hidden');
  $('myApplicationsView').classList.add('hidden');
  $('profileView').classList.add('hidden');
  $('savedJobsView').classList.remove('hidden');

  try {
    const result = await api('/api/saved-jobs');
    const container = $('savedJobsList');
    container.replaceChildren();

    if (!result.savedJobs.length) {
      container.textContent = 'You have not saved any jobs yet.';
      return;
    }

    result.savedJobs.forEach(job => {
      const box = document.createElement('div');
      box.className = 'job';
      box.innerHTML = '<h3>' + job.job_title + '</h3>' +
        '<p><strong>Company:</strong> ' + job.company + ' • ' + job.location + ' • ' + job.type + '</p>' +
        '<p>' + job.description + '</p>';

      const btnRow = document.createElement('div');
      btnRow.style.display = 'flex';
      btnRow.style.gap = '10px';
      btnRow.style.marginTop = '10px';

      const applyFromSavedBtn = document.createElement('button');
      applyFromSavedBtn.type = 'button';
      applyFromSavedBtn.textContent = 'Apply Now';
      applyFromSavedBtn.addEventListener('click', () => {
        $('savedJobsView').classList.add('hidden');
        $('mainDashboardContent').classList.remove('hidden');
        $('applicationSection').classList.remove('hidden');
        $('selectedJobOverview').innerHTML = '<h3>Applying for: ' + job.job_title + '</h3>' +
          '<p><strong>Company:</strong> ' + job.company + ' (' + job.location + ' - ' + job.type + ')</p>' +
          '<p><strong>Role Overview:</strong> ' + job.description + '</p>' +
          '<p><strong>What This Job Entails:</strong> ' + job.details + '</p>';
        $('applicantJobTitleInput').value = job.job_title;
        $('applicationSection').scrollIntoView({ behavior: 'smooth' });
      });

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.textContent = 'Remove';
      removeBtn.style.background = '#dc2626';
      removeBtn.addEventListener('click', async () => {
        try {
          await api('/api/saved-jobs/' + job.id, { method: 'DELETE' });
          box.remove();
          if (!container.children.length) {
            container.textContent = 'You have not saved any jobs yet.';
          }
        } catch (err) {
          alert(err.message);
        }
      });

      btnRow.append(applyFromSavedBtn, removeBtn);
      box.append(btnRow);
      container.append(box);
    });
  } catch (error) {
    alert(error.message);
  }
});

$('menuProfile').addEventListener('click', async () => {
  $('mainDashboardContent').classList.add('hidden');
  $('myApplicationsView').classList.add('hidden');
  $('savedJobsView').classList.add('hidden');
  $('profileView').classList.remove('hidden');

  try {
    const result = await api('/api/profile');
    const u = result.user;
    $('profFirstName').value = u.firstName || '';
    $('profLastName').value = u.lastName || '';
    $('profSurname').value = u.surname || '';
    $('profUsername').value = u.username || '';
    $('profEmail').value = u.email || '';
    $('profHeadline').value = u.headline || '';
    $('profBio').value = u.bio || '';
    $('profPhone').value = u.phone || '';
    $('profLocation').value = u.location || '';
    $('avatarBase64').value = u.avatar || '';

    if (u.avatar) {
      $('avatarPreview').src = u.avatar;
    }
  } catch (error) {
    alert(error.message);
  }
});

$('avatarInput').addEventListener('change', event => {
  const file = event.target.files[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    alert('Image file size must be less than 5MB');
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    $('avatarPreview').src = reader.result;
    $('avatarBase64').value = reader.result;
  };
  reader.readAsDataURL(file);
});

$('profileForm').addEventListener('submit', async event => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget).entries());

  try {
    const result = await api('/api/profile', {
      method: 'PUT',
      body: JSON.stringify(data)
    });

    if (data.avatar) {
      $('dashAvatar').src = data.avatar;
    }

    $('welcome').textContent = 'Welcome, ' + data.firstName + '!';
    showMessage('profileMessage', result.message);
  } catch (error) {
    showMessage('profileMessage', error.message);
  }
});

$('verifyAccountBtn').addEventListener('click', async () => {
  try {
    const result = await api('/api/profile/verify', { method: 'POST', body: '{}' });
    $('verifiedBadge').classList.remove('hidden');
    alert(result.message);
  } catch (error) {
    alert(error.message);
  }
});

$('backToDashboardFromAppsBtn').addEventListener('click', () => {
  $('myApplicationsView').classList.add('hidden');
  $('mainDashboardContent').classList.remove('hidden');
});

$('backToDashboardFromSavedBtn').addEventListener('click', () => {
  $('savedJobsView').classList.add('hidden');
  $('mainDashboardContent').classList.remove('hidden');
});

$('backToDashboardFromProfileBtn').addEventListener('click', () => {
  $('profileView').classList.add('hidden');
  $('mainDashboardContent').classList.remove('hidden');
});

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
    $('authView').classList.add('hidden');
    $('dashboardView').classList.add('hidden');
    $('authView').classList.remove('hidden');
  }
})();
</script>
</body>
</html>`;

initDB()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log('TalentPulse PRO running on port ' + PORT);
    });
  })
  .catch(error => {
    console.error('Database initialization failed:', error);
    process.exit(1);
  });
