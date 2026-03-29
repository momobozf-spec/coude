const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const session = require('express-session');

const app = express();
const PORT = 3000;
const RESPONSES_FILE = path.join(__dirname, 'data', 'responses.json');

// Admin credentials – wijzig dit naar jouw eigen wachtwoord
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'jamiljamila2025';

app.use(cors());
app.use(express.json());
app.use((req, res, next) => { res.setHeader('ngrok-skip-browser-warning', '1'); next(); });
app.use(session({
  secret: 'alnoor_secret_2025',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000 } // 8 uur
}));

// Auth middleware
function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  res.redirect('/login.html');
}

// Publieke bestanden (survey toegankelijk voor iedereen)
app.use('/survey.html', express.static(path.join(__dirname, 'survey.html')));
app.use('/login.html', express.static(path.join(__dirname, 'login.html')));

// Statische assets (css, js, fonts) publiek
app.use('/node_modules', express.static(path.join(__dirname, 'node_modules')));

// Beveiligde pagina's
app.get('/results.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'results.html'));
});
app.get('/admin.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Root redirect
app.get('/', (req, res) => res.redirect('/survey.html'));

// Login API
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    req.session.isAdmin = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Ongeldige gebruikersnaam of wachtwoord' });
  }
});

// Logout API
app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Check auth status
app.get('/api/auth', (req, res) => {
  res.json({ authenticated: !!(req.session && req.session.isAdmin) });
});

function readResponses() {
  if (!fs.existsSync(RESPONSES_FILE)) return { responses: [] };
  return JSON.parse(fs.readFileSync(RESPONSES_FILE, 'utf-8'));
}
function writeResponses(data) {
  fs.writeFileSync(RESPONSES_FILE, JSON.stringify(data, null, 2));
}

// Submit response (publiek – respondenten moeten kunnen indienen)
app.post('/api/responses', (req, res) => {
  const data = readResponses();
  data.responses.push({ id: Date.now().toString(), timestamp: new Date().toISOString(), answers: req.body });
  writeResponses(data);
  res.json({ success: true });
});

// Get all responses (beveiligd)
app.get('/api/responses', requireAuth, (req, res) => res.json(readResponses().responses));

// Delete all responses (beveiligd)
app.delete('/api/responses', requireAuth, (req, res) => {
  writeResponses({ responses: [] });
  res.json({ success: true });
});

// Export CSV (beveiligd)
app.get('/api/responses/export', requireAuth, (req, res) => {
  const { responses } = readResponses();
  if (!responses.length) return res.status(400).json({ error: 'Geen antwoorden' });

  const headers = [
    'Tijdstip','Leeftijd','Geslacht','Achtergrond','Regio','Online frequentie',
    'Aankoopkanalen','Gelegenheden','Productcategorieën','Budget product',
    'Budget geschenk','Prijs','Authenticiteit','Halal','Duurzaamheid',
    'Snelle levering','Verpakking','Klantendienst','Loyaliteit',
    'Wat mist u','Wat uniek','E-mail'
  ];

  const rows = responses.map(r => {
    const a = r.answers;
    const matrix = (key) => {
      const v = a.matrix?.[key];
      return v ? ['Helemaal niet','Niet','Neutraal','Belangrijk','Zeer'][v-1] || v : '';
    };
    return [
      r.timestamp,
      a.leeftijd || '', a.geslacht || '',
      Array.isArray(a.achtergrond) ? a.achtergrond.join('; ') : (a.achtergrond || ''),
      a.regio || '', a.frequentie || '',
      Array.isArray(a.kanalen) ? a.kanalen.join('; ') : (a.kanalen || ''),
      Array.isArray(a.gelegenheden) ? a.gelegenheden.join('; ') : (a.gelegenheden || ''),
      Array.isArray(a.categorieen) ? a.categorieen.join('; ') : (a.categorieen || ''),
      a.budget_product || '', a.budget_geschenk || '',
      matrix('prijs'), matrix('authenticiteit'), matrix('halal'),
      matrix('duurzaamheid'), matrix('levering'), matrix('verpakking'),
      matrix('klantendienst'), matrix('loyaliteit'),
      a.mist || '', a.uniek || '', a.email || ''
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="resultaten.csv"');
  res.send('\uFEFF' + [headers.join(','), ...rows].join('\n'));
});

app.listen(PORT, () => {
  console.log(`\nJamal & Jamila – Marktbevraging`);
  console.log(`Survey:     http://localhost:${PORT}/survey.html`);
  console.log(`Login:      http://localhost:${PORT}/login.html`);
  console.log(`Resultaten: http://localhost:${PORT}/results.html\n`);
});
