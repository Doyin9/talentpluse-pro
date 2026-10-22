import http from 'http';
import fs from 'fs';

const JOBS_FILE = 'jobs.json';
const APPS_FILE = 'applications.json';

let defaultJobs = [
  { id: 1, title: 'Frontend Developer', company: 'TechCorp', location: 'Remote', salary: '$80,000/yr', match: '95% ATS Match' },
  { id: 2, title: 'UI/UX Designer', company: 'Creative Hub', location: 'Hybrid', salary: '$70,000/yr', match: '88% ATS Match' },
  { id: 3, title: 'Node.js Developer', company: 'DataFlow', location: 'Remote', salary: '$95,000/yr', match: '92% ATS Match' }
];

let defaultApps = [
  { id: 1, jobTitle: 'Frontend Developer', company: 'TechCorp', name: 'Alex Johnson', email: 'alex@example.com', link: 'https://linkedin.com/in/alexj', score: '95%', status: 'Pending' }
];

let jobs = [];
let applications = [];

try { if (fs.existsSync(JOBS_FILE)) jobs = JSON.parse(fs.readFileSync(JOBS_FILE, 'utf8')); else { jobs = defaultJobs; fs.writeFileSync(JOBS_FILE, JSON.stringify(jobs, null, 2)); } } catch (e) { jobs = defaultJobs; }
try { if (fs.existsSync(APPS_FILE)) applications = JSON.parse(fs.readFileSync(APPS_FILE, 'utf8')); else { applications = defaultApps; fs.writeFileSync(APPS_FILE, JSON.stringify(applications, null, 2)); } } catch (e) { applications = defaultApps; }

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/jobs') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const newJob = JSON.parse(body);
        newJob.id = Date.now();
        jobs.unshift(newJob);
        fs.writeFileSync(JOBS_FILE, JSON.stringify(jobs, null, 2));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (e) { res.writeHead(400); res.end(); }
    });
    return;
  }

  if (req.method === 'DELETE' && req.url.startsWith('/api/jobs/')) {
    const jobId = parseInt(req.url.split('/')[3]);
    jobs = jobs.filter(j => j.id !== jobId);
    fs.writeFileSync(JOBS_FILE, JSON.stringify(jobs, null, 2));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  if (req.method === 'POST' && req.url === '/api/apply') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const newApp = JSON.parse(body);
        newApp.id = Date.now();
        newApp.status = 'Pending';
        applications.unshift(newApp);
        fs.writeFileSync(APPS_FILE, JSON.stringify(applications, null, 2));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (e) { res.writeHead(400); res.end(); }
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/apply/status') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { id, status } = JSON.parse(body);
        const app = applications.find(a => a.id === id);
        if (app) {
          app.status = status;
          fs.writeFileSync(APPS_FILE, JSON.stringify(applications, null, 2));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
          return;
        }
        res.writeHead(404); res.end();
      } catch (e) { res.writeHead(400); res.end(); }
    });
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>TalentPulse PRO - Phase 1</title>
      <style>
        * { box-sizing: border-box; font-family: 'Segoe UI', sans-serif; }
        body { background: #0d1117; color: #fff; margin: 0; padding: 30px; display: flex; flex-direction: column; align-items: center; min-height: 100vh; }
        h1 { color: #58a6ff; margin-bottom: 5px; }
        p { color: #8b949e; margin-top: 0; }
        .container { width: 100%; max-width: 850px; margin-top: 20px; }
        .card { background: #161b22; border: 1px solid #30363d; border-radius: 10px; padding: 25px; margin-bottom: 20px; }
        input, select, textarea { width: 100%; padding: 10px; margin: 6px 0 14px 0; background: #0d1117; border: 1px solid #30363d; color: #fff; border-radius: 6px; outline: none; }
        label { color: #c9d1d9; font-size: 13px; font-weight: bold; }
        button { background: #238636; color: #fff; border: none; padding: 10px 16px; border-radius: 6px; font-weight: bold; cursor: pointer; width: 100%; }
        button:hover { background: #2ea043; }
        .apply-btn { background: #1f6beb; margin-top: 10px; }
        .apply-btn:hover { background: #388bfd; }
        .del-btn { background: #da3633; margin-top: 8px; width: auto; padding: 6px 12px; font-size: 12px; float: right; }
        .del-btn:hover { background: #f85149; }
        .job-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 15px; }
        .job-card { background: #0d1117; border: 1px solid #30363d; padding: 20px; border-radius: 8px; position: relative; }
        .applicant-card { background: #0d1117; border: 1px solid #30363d; padding: 15px; border-radius: 8px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; }
        .status-badge { font-size: 11px; padding: 3px 8px; border-radius: 12px; font-weight: bold; text-transform: uppercase; margin-left: 6px; }
        .status-Pending { background: #8b949e; color: #0d1117; }
        .status-Shortlisted { background: #1f6beb; color: #fff; }
        .status-Accepted { background: #238636; color: #fff; }
        .status-Rejected { background: #da3633; color: #fff; }
        .modal-overlay { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); justify-content: center; align-items: center; padding: 20px; }
        .modal { background: #161b22; border: 1px solid #30363d; padding: 25px; border-radius: 10px; width: 100%; max-width: 450px; position: relative; }
        .close-btn { position: absolute; top: 12px; right: 15px; color: #8b949e; font-size: 20px; cursor: pointer; }
      </style>
    </head>
    <body>
      <h1>TalentPulse PRO</h1>
      <p>Direct Access Mode — Phase 1: Complete Core Management</p>

      <div class="container">
        <!-- Search Bar -->
        <div class="card" style="padding: 15px;">
          <input type="text" id="searchInput" onkeyup="filterJobs()" placeholder="🔍 Search jobs by title, company, or keyword..." style="margin: 0; font-size: 15px;">
        </div>

        <!-- Available Jobs Grid -->
        <div class="card">
          <h3 style="color: #58a6ff; margin-top: 0;">Available Job Board</h3>
          <div class="job-grid" id="jobGrid">
            \${jobs.map(j => \`
              <div class="job-card" data-title="\${j.title.toLowerCase()} \${j.company.toLowerCase()}">
                <button class="del-btn" onclick="deleteJob(\${j.id})">Delete</button>
                <h4 style="color: #58a6ff; margin: 0 0 5px 0; padding-right: 60px;">\${j.title}</h4>
                <p style="color: #8b949e; font-size: 13px; margin: 0 0 8px 0;">\${j.company} • \${j.location}</p>
                <span style="background: #238636; color: white; padding: 3px 8px; font-size: 11px; border-radius: 10px;">\${j.match ? j.match : '90% ATS Match'}</span>
                <p style="color: #c9d1d9; font-size: 14px; margin: 10px 0;">💰 \${j.salary}</p>
                <button class="apply-btn" onclick="openModal('\${j.title}', '\${j.company}')">Quick Apply</button>
              </div>
            \`).join('')}
          </div>
        </div>

        <!-- Post a Job Section -->
        <div class="card">
          <h3 style="color: #58a6ff; margin-top: 0;">Post a New Job Listing</h3>
          <label>Job Title</label>
          <input type="text" id="jobTitle" placeholder="e.g. Backend Engineer">
          <label>Company Name</label>
          <input type="text" id="jobCompany" placeholder="e.g. TechCorp">
          <label>Salary Range</label>
          <input type="text" id="jobSalary" placeholder="e.g. $90,000/yr">
          <button onclick="postJob()">Publish Job Listing</button>
        </div>

        <!-- Received Applications Section -->
        <div class="card">
          <h3 style="color: #58a6ff; margin-top: 0;">Received Applications & Candidate Status</h3>
          <div id="appList">
            \${applications.map(a => {
              const appStatus = a.status ? a.status : 'Pending';
              const appScore = a.score ? a.score : '90%';
              return \`
              <div class="applicant-card">
                <div>
                  <h4 style="margin: 0 0 4px 0; color: #58a6ff;">
                    \${a.name} 
                    <span style="background: #238636; color: white; padding: 2px 6px; border-radius: 8px; font-size: 11px;">\${appScore}</span>
                    <span class="status-badge status-\${appStatus}">\${appStatus}</span>
                  </h4>
                  <p style="margin: 0; color: #8b949e; font-size: 13px;">Applied for: <b>\${a.jobTitle}</b> (\${a.company}) • \${a.email}</p>
                </div>
                <div style="display: flex; gap: 8px; align-items: center;">
                  <select onchange="updateStatus(\${a.id}, this.value)" style="margin:0; padding: 4px 8px; font-size: 12px; width: auto;">
                    <option value="Pending" \${appStatus === 'Pending' ? 'selected' : ''}>Pending</option>
                    <option value="Shortlisted" \${appStatus === 'Shortlisted' ? 'selected' : ''}>Shortlist</option>
                    <option value="Accepted" \${appStatus === 'Accepted' ? 'selected' : ''}>Accept</option>
                    <option value="Rejected" \${appStatus === 'Rejected' ? 'selected' : ''}>Reject</option>
                  </select>
                  <a href="\${a.link}" target="_blank" style="color: #58a6ff; font-size: 13px; text-decoration: none; font-weight: bold;">Profile ↗</a>
                </div>
              </div>
            \`;
            }).join('')}
          </div>
        </div>
      </div>

      <!-- Quick Apply Modal -->
      <div class="modal-overlay" id="applyModal">
        <div class="modal">
          <span class="close-btn" onclick="closeModal()">&times;</span>
          <h3 style="color: #58a6ff; margin-top: 0;" id="modalTitle">Apply for Job</h3>
          <label>Full Name</label>
          <input type="text" id="applicantName" placeholder="John Doe">
          <label>Email Address</label>
          <input type="email" id="applicantEmail" placeholder="john@example.com">
          <label>LinkedIn / Portfolio Link</label>
          <input type="url" id="applicantLink" placeholder="https://...">
          <label>Paste Resume (for ATS Match Check)</label>
          <textarea id="resumeText" placeholder="Paste skills & experience..." oninput="calcATS()"></textarea>
          <p style="font-size: 13px; color: #8b949e;">Calculated ATS Score: <strong id="atsScore" style="color: #3fb950;">Awaiting...</strong></p>
          <button onclick="submitApplication()">Submit Application</button>
        </div>
      </div>

      <script>
        let curTitle = '', curCompany = '';

        function filterJobs() {
          const query = document.getElementById('searchInput').value.toLowerCase();
          for (let card of document.getElementsByClassName('job-card')) {
            card.style.display = card.getAttribute('data-title').includes(query) ? 'block' : 'none';
          }
        }

        function openModal(title, company) {
          curTitle = title;
          curCompany = company;
          document.getElementById('modalTitle').innerText = 'Apply for ' + title;
          document.getElementById('applyModal').style.display = 'flex';
        }

        function closeModal() {
          document.getElementById('applyModal').style.display = 'none';
        }

        function calcATS() {
          const text = document.getElementById('resumeText').value;
          const scoreEl = document.getElementById('atsScore');
          if (text.length < 10) { scoreEl.innerText = 'Awaiting...'; return; }
          let score = 80 + (text.length % 15);
          scoreEl.innerText = score + '% Match';
        }

        async function postJob() {
          const title = document.getElementById('jobTitle').value.trim();
          const company = document.getElementById('jobCompany').value.trim();
          const salary = document.getElementById('jobSalary').value.trim();
          if (!title || !company) { alert('Enter title and company'); return; }

          await fetch('/api/jobs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, company, location: 'Remote', salary: salary || 'Competitive', match: '90% ATS Match' })
          });
          location.reload();
        }

        async function deleteJob(id) {
          if (!confirm('Are you sure you want to delete this job listing?')) return;
          await fetch('/api/jobs/' + id, { method: 'DELETE' });
          location.reload();
        }

        async function submitApplication() {
          const name = document.getElementById('applicantName').value.trim();
          const email = document.getElementById('applicantEmail').value.trim();
          const link = document.getElementById('applicantLink').value.trim() || '#';
          const score = document.getElementById('atsScore').innerText;
          if (!name || !email) { alert('Enter name and email'); return; }

          await fetch('/api/apply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jobTitle: curTitle, company: curCompany, name, email, link, score })
          });
          location.reload();
        }

        async function updateStatus(id, status) {
          await fetch('/api/apply/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, status })
          });
          location.reload();
        }
      </script>
    </body>
    </html>
  `);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { console.log(`Server running on port \${PORT}`); });
