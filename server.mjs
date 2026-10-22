 import http from 'http';
import fs from 'fs';

const JOBS_FILE = 'jobs.json';
const APPS_FILE = 'applications.json';

let defaultJobs = [
  { id: 1, title: 'Frontend Developer', company: 'TechCorp', location: 'Remote', salary: '$90,000/yr' },
  { id: 2, title: 'UI/UX Designer', company: 'Creative Hub', location: 'Lagos', salary: '$75,000/yr' },
  { id: 3, title: 'Node.js Developer', company: 'DataFlow', location: 'Hybrid', salary: '$100,000/yr' }
];

let defaultApps = [
  { id: 1, jobTitle: 'Frontend Developer', company: 'TechCorp', name: 'John Doe', email: 'john@example.com', status: 'Pending', score: '90%', resume: 'https://linkedin.com' }
];

let jobs = [];
let applications = [];

try { if (fs.existsSync(JOBS_FILE)) jobs = JSON.parse(fs.readFileSync(JOBS_FILE)); } catch (e) {}
try { if (fs.existsSync(APPS_FILE)) applications = JSON.parse(fs.readFileSync(APPS_FILE)); } catch (e) {}

if (!jobs || jobs.length === 0) jobs = [...defaultJobs];
if (!applications || applications.length === 0) applications = [...defaultApps];

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

  if (req.method === 'POST' && req.url === '/api/applications') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const newApp = JSON.parse(body);
        newApp.id = Date.now();
        newApp.status = 'Pending';
        newApp.score = '92%';
        applications.unshift(newApp);
        fs.writeFileSync(APPS_FILE, JSON.stringify(applications, null, 2));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (e) { res.writeHead(400); res.end(); }
    });
    return;
  }

  if (req.method === 'DELETE' && req.url.startsWith('/api/applications/')) {
    const appId = parseInt(req.url.split('/')[3]);
    applications = applications.filter(a => a.id !== appId);
    fs.writeFileSync(APPS_FILE, JSON.stringify(applications, null, 2));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  if (req.method === 'POST' && req.url.includes('/status')) {
    const parts = req.url.split('/');
    const appId = parseInt(parts[3]);
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { status } = JSON.parse(body);
        const app = applications.find(a => a.id === appId);
        if (app) {
          app.status = status;
          fs.writeFileSync(APPS_FILE, JSON.stringify(applications, null, 2));
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (e) { res.writeHead(400); res.end(); }
    });
    return;
  }

  if (req.method === 'GET' && req.url === '/api/jobs') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(jobs));
    return;
  }

  // Render HTML interface
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });

  const appCards = applications.map(a => {
    let badgeColor = '#eab308'; // Pending
    if (a.status === 'Interviewing') badgeColor = '#38bdf8';
    if (a.status === 'Hired') badgeColor = '#16a34a';
    if (a.status === 'Rejected') badgeColor = '#ef4444';

    return `
      <div style="background:#1e293b; padding:12px; border-radius:8px; margin-bottom:10px; border:1px solid #334155; position:relative;">
        <button onclick="deleteApp(${a.id})" style="position:absolute; top:12px; right:12px; background:#ef4444; color:#fff; border:none; padding:3px 6px; border-radius:4px; cursor:pointer; font-size:11px;">Remove</button>
        <h4 style="margin:0 0 4px 0; color:#f8fafc; font-size:14px;">${a.name} <span style="background:${badgeColor}; color:#fff; font-size:10px; padding:2px 5px; border-radius:4px;">${a.status || 'Pending'}</span> <span style="background:#0284c7; color:#fff; font-size:10px; padding:2px 5px; border-radius:4px;">${a.score || '90%'}</span></h4>
        <p style="margin:0 0 6px 0; color:#94a3b8; font-size:12px;">Applied for: <strong>${a.jobTitle}</strong> (${a.company})</p>
        <p style="margin:0 0 8px 0; color:#64748b; font-size:11px;">Email: ${a.email} &bull; <a href="${a.resume}" target="_blank" style="color:#38bdf8;">View Profile</a></p>
        <div style="display:flex; gap:5px; margin-top:5px;">
          <button onclick="updateStatus(${a.id}, 'Interviewing')" style="background:#0284c7; color:#fff; border:none; padding:4px 8px; border-radius:4px; font-size:10px; cursor:pointer;">Interview</button>
          <button onclick="updateStatus(${a.id}, 'Hired')" style="background:#16a34a; color:#fff; border:none; padding:4px 8px; border-radius:4px; font-size:10px; cursor:pointer;">Hire</button>
          <button onclick="updateStatus(${a.id}, 'Rejected')" style="background:#64748b; color:#fff; border:none; padding:4px 8px; border-radius:4px; font-size:10px; cursor:pointer;">Reject</button>
        </div>
      </div>
    `;
  }).join('');

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>TalentPulse PRO</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 15px; }
        .container { max-width: 600px; margin: 0 auto; }
        h1 { text-align: center; color: #38bdf8; margin-bottom: 5px; font-size: 22px; }
        .subtitle { text-align: center; color: #64748b; font-size: 11px; margin-bottom: 20px; }
        .card { background: #0f172a; border: 1px solid #1e293b; border-radius: 10px; padding: 15px; margin-bottom: 20px; }
        .section-title { font-size: 16px; color: #38bdf8; margin-top: 0; margin-bottom: 12px; }
        input { width: 100%; padding: 10px; margin-bottom: 10px; background: #1e293b; border: 1px solid #334155; color: #fff; border-radius: 6px; box-sizing: border-box; }
        button.submit-btn { width: 100%; background: #16a34a; color: #fff; border: none; padding: 10px; border-radius: 6px; font-weight: bold; cursor: pointer; }
        .search-box { position: relative; margin-bottom: 15px; }
        .search-box input { padding-left: 35px; border-color: #38bdf8; }
        .search-icon { position: absolute; left: 10px; top: 10px; color: #94a3b8; font-size: 14px; }
        .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 1000; justify-content: center; align-items: center; padding: 15px; box-sizing: border-box; }
        .modal-content { background: #1e293b; padding: 20px; border-radius: 10px; width: 100%; max-width: 400px; border: 1px solid #334155; position: relative; }
        .close-btn { position: absolute; top: 10px; right: 15px; background: none; border: none; color: #94a3b8; font-size: 20px; cursor: pointer; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>TalentPulse PRO</h1>
        <div class="subtitle">Direct Access Mode &mdash; Real-Time Interactive System</div>

        <div class="card">
          <h2 class="section-title">Available Job Board</h2>
          
          <div class="search-box">
            <span class="search-icon">🔍</span>
            <input type="text" id="searchInput" placeholder="Search jobs by title, company, or location..." onkeyup="filterJobs()">
          </div>

          <div id="jobList"></div>
        </div>

        <div class="card">
          <h2 class="section-title">Post a New Job Listing</h2>
          <form id="jobForm">
            <input type="text" id="title" placeholder="Job Title (e.g. Backend Engineer)" required>
            <input type="text" id="company" placeholder="Company Name (e.g. TechCorp)" required>
            <input type="text" id="salary" placeholder="Salary Range (e.g. $90,000/yr)">
            <button type="submit" id="publishBtn" class="submit-btn">Publish Job Listing</button>
          </form>
        </div>

        <div class="card">
          <h2 class="section-title">Received Applications & Candidate Status</h2>
          <div>${appCards}</div>
        </div>
      </div>

      <!-- Quick Apply Modal -->
      <div id="applyModal" class="modal">
        <div class="modal-content">
          <button class="close-btn" onclick="closeModal()">&times;</button>
          <h3 style="color:#38bdf8; margin-top:0;" id="modalJobTitle">Quick Apply</h3>
          <p style="color:#94a3b8; font-size:12px; margin-bottom:15px;" id="modalCompany"></p>
          <form id="applyForm">
            <input type="hidden" id="applyJobTitle">
            <input type="hidden" id="applyCompany">
            <input type="text" id="applicantName" placeholder="Your Full Name" required>
            <input type="email" id="applicantEmail" placeholder="Your Email Address" required>
            <input type="url" id="applicantResume" placeholder="Portfolio or LinkedIn URL" required>
            <button type="submit" id="applyBtn" class="submit-btn">Submit Application</button>
          </form>
        </div>
      </div>

      <script>
        const allJobs = ${JSON.stringify(jobs)};

        function renderJobs(jobsToDisplay) {
          const jobContainer = document.getElementById('jobList');
          if (jobsToDisplay.length === 0) {
            jobContainer.innerHTML = '<p style="color:#94a3b8; text-align:center; padding:10px;">No jobs matching your search.</p>';
            return;
          }
          jobContainer.innerHTML = jobsToDisplay.map(j => \`
            <div style="background:#1e293b; padding:15px; border-radius:8px; margin-bottom:12px; border:1px solid #334155; position:relative;">
              <button onclick="deleteJob(\${j.id})" style="position:absolute; top:12px; right:12px; background:#ef4444; color:#fff; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:12px;">Delete</button>
              <h3 style="margin:0 0 5px 0; color:#38bdf8; font-size:16px;">\${j.title}</h3>
              <p style="margin:0 0 8px 0; color:#94a3b8; font-size:13px;">\${j.company} &bull; \${j.location || 'Remote'}</p>
              <div style="margin-bottom:10px;"><span style="background:#0284c7; color:#fff; font-size:11px; padding:2px 6px; border-radius:4px;">90% ATS Match</span></div>
              <p style="margin:0 0 10px 0; font-weight:bold; color:#f1f5f9; font-size:14px;">💰 \${j.salary || '$80,000/yr'}</p>
              <button onclick="openApplyModal('\${j.title}', '\${j.company}')" style="width:100%; background:#2563eb; color:#fff; border:none; padding:8px; border-radius:6px; font-weight:bold; cursor:pointer;">Quick Apply</button>
            </div>
          \`).join('');
        }

        function filterJobs() {
          const query = document.getElementById('searchInput').value.toLowerCase();
          const filtered = allJobs.filter(j => 
            j.title.toLowerCase().includes(query) ||
            j.company.toLowerCase().includes(query) ||
            (j.location && j.location.toLowerCase().includes(query))
          );
          renderJobs(filtered);
        }

        renderJobs(allJobs);

        function openApplyModal(title, company) {
          document.getElementById('modalJobTitle').innerText = 'Apply for: ' + title;
          document.getElementById('modalCompany').innerText = company;
          document.getElementById('applyJobTitle').value = title;
          document.getElementById('applyCompany').value = company;
          document.getElementById('applyModal').style.display = 'flex';
        }

        function closeModal() {
          document.getElementById('applyModal').style.display = 'none';
        }

        document.getElementById('jobForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const btn = document.getElementById('publishBtn');
          btn.innerText = 'Publishing...';
          btn.disabled = true;

          const title = document.getElementById('title').value;
          const company = document.getElementById('company').value;
          const salary = document.getElementById('salary').value;
          
          const res = await fetch('/api/jobs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, company, salary })
          });

          if (res.ok) {
            window.location.href = window.location.pathname + '?t=' + Date.now();
          }
        });

        document.getElementById('applyForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const btn = document.getElementById('applyBtn');
          btn.innerText = 'Submitting...';
          btn.disabled = true;

          const jobTitle = document.getElementById('applyJobTitle').value;
          const company = document.getElementById('applyCompany').value;
          const name = document.getElementById('applicantName').value;
          const email = document.getElementById('applicantEmail').value;
          const resume = document.getElementById('applicantResume').value;

          const res = await fetch('/api/applications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jobTitle, company, name, email, resume })
          });

          if (res.ok) {
            window.location.href = window.location.pathname + '?t=' + Date.now();
          }
        });

        async function updateStatus(id, status) {
          const res = await fetch('/api/applications/' + id + '/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
          });
          if (res.ok) {
            window.location.href = window.location.pathname + '?t=' + Date.now();
          }
        }

        async function deleteApp(id) {
          if (confirm('Remove this application?')) {
            const res = await fetch('/api/applications/' + id, { method: 'DELETE' });
            if (res.ok) {
              window.location.href = window.location.pathname + '?t=' + Date.now();
            }
          }
        }

        async function deleteJob(id) {
          if (confirm('Delete this job listing?')) {
            const res = await fetch('/api/jobs/' + id, { method: 'DELETE' });
            if (res.ok) {
              window.location.href = window.location.pathname + '?t=' + Date.now();
            }
          }
        }
      </script>
    </body>
    </html>
  `;

  res.end(html);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
