const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Seed Data ─────────────────────────────────────────────────────────────
const SEED_TOOLS = [
  { id:"T001", name:"Milwaukee M18 Drill",  category:"Power Tools", location:"Bay A", status:"available",    maintainStatus:"Good",          checkedOutTo:null, checkedOutEmail:null, checkedOutAt:null, emailSent:false, history:[] },
  { id:"T002", name:"Dewalt Circular Saw",  category:"Power Tools", location:"Bay A", status:"checked_out",  maintainStatus:"Good",          checkedOutTo:"John Smith",  checkedOutEmail:"john@example.com",  checkedOutAt:new Date(Date.now()-52*3600000).toISOString(),  emailSent:false, history:[] },
  { id:"T003", name:"Tape Measure 25ft",    category:"Hand Tools",  location:"Bay B", status:"checked_out",  maintainStatus:"Good",          checkedOutTo:"Maria Garcia", checkedOutEmail:"maria@example.com", checkedOutAt:new Date(Date.now()-30*3600000).toISOString(),  emailSent:false, history:[] },
  { id:"T004", name:"Impact Wrench",        category:"Power Tools", location:"Bay C", status:"available",    maintainStatus:"Needs Service", checkedOutTo:null, checkedOutEmail:null, checkedOutAt:null, emailSent:false, history:[] },
  { id:"T005", name:"Level 48in",           category:"Hand Tools",  location:"Bay B", status:"available",    maintainStatus:"Good",          checkedOutTo:null, checkedOutEmail:null, checkedOutAt:null, emailSent:false, history:[] },
];
const SEED_PPE = [
  { id:"PPE001", type:"Hard Hat",       person:"John Smith",  email:"john@example.com",  issuedAt:new Date(Date.now()-150*86400000).toISOString(), size:"L", color:"Yellow", notes:"", reminderSent:false },
  { id:"PPE002", type:"Safety Glasses", person:"Maria Garcia",email:"maria@example.com", issuedAt:new Date(Date.now()-60*86400000).toISOString(),  size:"M", color:"Clear",  notes:"", reminderSent:false },
  { id:"PPE003", type:"Hi-Vis Vest",    person:"Maria Garcia",email:"maria@example.com", issuedAt:new Date(Date.now()-162*86400000).toISOString(), size:"L", color:"Orange", notes:"", reminderSent:false },
];
const SEED_METERS = [
  { id:"CAL001", brand:"Fluke", model:"87V",   serial:"FLK-8892", person:"John Smith",  email:"john@example.com",  issuedAt:new Date(Date.now()-300*86400000).toISOString(), calDue:new Date(Date.now()+20*86400000).toISOString(),  calInterval:365, reminderSent:false, notes:"" },
  { id:"CAL002", brand:"Klein", model:"MM600", serial:"KLN-4421", person:"Maria Garcia",email:"maria@example.com", issuedAt:new Date(Date.now()-200*86400000).toISOString(), calDue:new Date(Date.now()+90*86400000).toISOString(),  calInterval:365, reminderSent:false, notes:"" },
  { id:"CAL003", brand:"Fluke", model:"117",   serial:"FLK-2234", person:"Tom Rivera",  email:"tom@example.com",   issuedAt:new Date(Date.now()-100*86400000).toISOString(), calDue:new Date(Date.now()-5*86400000).toISOString(),   calInterval:365, reminderSent:true,  notes:"Sent to lab" },
];
const DEFAULT_CATEGORIES = ["Power Tools","Hand Tools","Measuring","Safety","Lifting","Other"];

// ─── Data helpers ──────────────────────────────────────────────────────────
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch(e) {}
  return {
    tools: SEED_TOOLS,
    ppe: SEED_PPE,
    meters: SEED_METERS,
    categories: DEFAULT_CATEGORIES
  };
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

let db = loadData();

// ─── Auth ──────────────────────────────────────────────────────────────────
const USERS = [
  { username:"IEMadmin", password:"admin123", role:"admin",    display:"Admin" },
  { username:"IEM",      password:"IEM123",   role:"nonadmin", display:"Staff" },
];

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = USERS.find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  res.json({ username: user.username, role: user.role, display: user.display });
});

// ─── Tools ─────────────────────────────────────────────────────────────────
app.get('/api/tools', (req, res) => res.json(db.tools));

app.post('/api/tools', (req, res) => {
  const tool = req.body;
  if (!tool.id || !tool.name) return res.status(400).json({ error: 'id and name required' });
  if (db.tools.find(t => t.id === tool.id)) return res.status(409).json({ error: 'Tool ID already exists' });
  db.tools.push({ ...tool, status:'available', checkedOutTo:null, checkedOutEmail:null, checkedOutAt:null, emailSent:false, history:[] });
  saveData(db);
  res.json(db.tools);
});

app.delete('/api/tools/:id', (req, res) => {
  db.tools = db.tools.filter(t => t.id !== req.params.id);
  saveData(db);
  res.json(db.tools);
});

app.post('/api/tools/:id/checkout', (req, res) => {
  const { name, email } = req.body;
  const tool = db.tools.find(t => t.id === req.params.id);
  if (!tool) return res.status(404).json({ error: 'Tool not found' });
  tool.status = 'checked_out';
  tool.checkedOutTo = name;
  tool.checkedOutEmail = email;
  tool.checkedOutAt = new Date().toISOString();
  tool.emailSent = false;
  saveData(db);
  res.json(db.tools);
});

app.post('/api/tools/:id/return', (req, res) => {
  const tool = db.tools.find(t => t.id === req.params.id);
  if (!tool) return res.status(404).json({ error: 'Tool not found' });
  tool.history = [...(tool.history || []), {
    person: tool.checkedOutTo,
    email: tool.checkedOutEmail,
    checkedOutAt: tool.checkedOutAt,
    returnedAt: new Date().toISOString()
  }];
  tool.status = 'available';
  tool.checkedOutTo = null;
  tool.checkedOutEmail = null;
  tool.checkedOutAt = null;
  tool.emailSent = false;
  saveData(db);
  res.json(db.tools);
});

app.patch('/api/tools/:id/maintain', (req, res) => {
  const tool = db.tools.find(t => t.id === req.params.id);
  if (!tool) return res.status(404).json({ error: 'Tool not found' });
  tool.maintainStatus = req.body.maintainStatus;
  saveData(db);
  res.json(db.tools);
});

app.post('/api/tools/import', (req, res) => {
  const imported = req.body;
  const existing = new Set(db.tools.map(t => t.id));
  const added = imported.filter(t => !existing.has(t.id));
  db.tools = [...db.tools, ...added];
  saveData(db);
  res.json(db.tools);
});

// ─── Categories ────────────────────────────────────────────────────────────
app.get('/api/categories', (req, res) => res.json(db.categories));

app.post('/api/categories', (req, res) => {
  const { name } = req.body;
  if (!name || db.categories.includes(name)) return res.status(400).json({ error: 'Invalid or duplicate category' });
  db.categories.push(name);
  saveData(db);
  res.json(db.categories);
});

app.delete('/api/categories/:name', (req, res) => {
  db.categories = db.categories.filter(c => c !== decodeURIComponent(req.params.name));
  saveData(db);
  res.json(db.categories);
});

// ─── PPE ──────────────────────────────────────────────────────────────────
app.get('/api/ppe', (req, res) => res.json(db.ppe));

app.post('/api/ppe', (req, res) => {
  db.ppe.push(req.body);
  saveData(db);
  res.json(db.ppe);
});

app.delete('/api/ppe/:id', (req, res) => {
  db.ppe = db.ppe.filter(p => p.id !== req.params.id);
  saveData(db);
  res.json(db.ppe);
});

app.patch('/api/ppe/:id/reissue', (req, res) => {
  const ppe = db.ppe.find(p => p.id === req.params.id);
  if (!ppe) return res.status(404).json({ error: 'PPE not found' });
  ppe.issuedAt = new Date().toISOString();
  ppe.reminderSent = false;
  saveData(db);
  res.json(db.ppe);
});

app.patch('/api/ppe/:id/reminder', (req, res) => {
  const ppe = db.ppe.find(p => p.id === req.params.id);
  if (!ppe) return res.status(404).json({ error: 'PPE not found' });
  ppe.reminderSent = true;
  saveData(db);
  res.json(db.ppe);
});

// ─── Meters ────────────────────────────────────────────────────────────────
app.get('/api/meters', (req, res) => res.json(db.meters));

app.post('/api/meters', (req, res) => {
  db.meters.push(req.body);
  saveData(db);
  res.json(db.meters);
});

app.delete('/api/meters/:id', (req, res) => {
  db.meters = db.meters.filter(m => m.id !== req.params.id);
  saveData(db);
  res.json(db.meters);
});

app.patch('/api/meters/:id/caldate', (req, res) => {
  const meter = db.meters.find(m => m.id === req.params.id);
  if (!meter) return res.status(404).json({ error: 'Meter not found' });
  meter.calDue = req.body.calDue;
  meter.reminderSent = false;
  saveData(db);
  res.json(db.meters);
});

app.patch('/api/meters/:id/reminder', (req, res) => {
  const meter = db.meters.find(m => m.id === req.params.id);
  if (!meter) return res.status(404).json({ error: 'Meter not found' });
  meter.reminderSent = true;
  saveData(db);
  res.json(db.meters);
});

// ─── Reset ─────────────────────────────────────────────────────────────────
app.post('/api/reset', (req, res) => {
  db = {
    tools: SEED_TOOLS.map(t => ({ ...t, history: [] })),
    ppe: SEED_PPE,
    meters: SEED_METERS,
    categories: DEFAULT_CATEGORIES
  };
  saveData(db);
  res.json(db);
});

// ─── Serve frontend ────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`IEM Tracker running at http://${HOST}:${PORT}`);
});
