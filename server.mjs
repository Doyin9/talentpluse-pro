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
  { id: 1, jobTitle: 'Frontend Developer', company: 'TechCorp', name: 'John Doe', email: 'john@example.com', status: 'Pending', score: '90%' }
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

  if (req.method === 'GET' && req.url === '/api/jobs') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(jobs));
    return;
  }

  // Render HTML interface
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });

  const jobCards = jobs.map(j => `
    <div style="background:#1e293b; padding:15px; border-radius:8px; margin-bottom:12px; border:1px solid #334155; position:relative;">
      <button onclick="deleteJob(${j.id})" style="position:absolute; top:12px; right:12px; background:#ef4444; color:#fff; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:12px;">Delete</button>
      <h3 style="margin:0 0 5px 0; color:#38bdf8; font-size:16px;">${j.title}</h3>
      <p style="margin:0 0 8px 0; color:#94a3b8; font-size:13px;">${j.company} &bull; ${j.location || 'Remote'}</p>
      <div style="margin-bottom:10px;"><span style="background:#0284c7; color:#fff; font-size:11px; padding:2px 6px; border-radius:4px;">90% ATS Match</span></div>
      <p style="margin:0 0 10px 0; font-weight:bold; color:#f1f5f9; font-size:14px;">💰 ${j.salary || '$80,000/yr'}</p>
      <button style="width:100%; background:#2563eb; color:#fff; border:none; padding:8px; border-radius:6px; font-weight:bold; cursor:pointer;">Quick Apply</button>
    </div>
  `).join('');

  const appCards = applications.map(a => `
    <div style="background:#1e293b; padding:12px; border-radius:8px; margin-bottom:10px; border:1px solid #334155;">
      <h4 style="margin:0 0 4px 0; color:#f8fafc; font-size:14px;">${a.name} <span style="background:#16a34a; color:#fff; font-size:10px; padding:2px 5px; border-radius:4px;">${a.score || '90%'}</span></h4>
      <p style="margin:0; color:#94a3b8; font-size:12px;">Applied for: ${a.jobTitle} (${a.company}) &bull; ${a.email}</p>
    </div>
  `).join('');

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
      </style>
    </head>
    <body>
      <div class="container">
        <h1>TalentPulse PRO</h1>
        <div class="subtitle">Direct Access Mode &mdash; Phase 1: Complete Core Management</div>

        <div class="card">
          <h2 class="section-title">Available Job Board</h2>
          <div id="jobList">${jobCards}</div>
        </div>

        <div class="card">
          <h2 class="section-title">Post a New Job Listing</h2>
          <form id="jobForm">
            <input type="text" id="title" placeholder="Job Title (e.g. Backend Engineer)" required>
            <input type="text" id="company" placeholder="Company Name (e.g. TechCorp)" required>
            <input type="text" id="salary" placeholder="Salary Range (e.g. $90,000/yr)">
            <button type="submit" class="submit-btn">Publish Job Listing</button>
          </form>
        </div>

        <div class="card">
          <h2 class="section-title">Received Applications & Candidate Status</h2>
          <div>${appCards}</div>
        </div>
      </div>

      <script>
        document.getElementById('jobForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const title = document.getElementById('title').value;
          const company = document.getElementById('company').value;
          const salary = document.getElementById('salary').value;
          
          await fetch('/api/jobs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, company, salary })
          });
          window.location.reload();
        });

        async function deleteJob(id) {
          if (confirm('Delete this job listing?')) {
            await fetch('/api/jobs/' + id, { method: 'DELETE' });
            window.location.reload();
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
