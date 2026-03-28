const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const RESPONSES_FILE = path.join(__dirname, 'data', 'responses.json');

app.use(cors());
app.use(express.json());
app.use((req, res, next) => { res.setHeader('ngrok-skip-browser-warning', '1'); next(); });
app.use(express.static(__dirname));

function readResponses() {
  if (!fs.existsSync(RESPONSES_FILE)) return { responses: [] };
  return JSON.parse(fs.readFileSync(RESPONSES_FILE, 'utf-8'));
}
function writeResponses(data) {
  fs.writeFileSync(RESPONSES_FILE, JSON.stringify(data, null, 2));
}

// Submit response
app.post('/api/responses', (req, res) => {
  const data = readResponses();
  data.responses.push({ id: Date.now().toString(), timestamp: new Date().toISOString(), answers: req.body });
  writeResponses(data);
  res.json({ success: true });
});

// Get all responses
app.get('/api/responses', (req, res) => res.json(readResponses().responses));

// Delete all responses
app.delete('/api/responses', (req, res) => {
  writeResponses({ responses: [] });
  res.json({ success: true });
});

// Export CSV
app.get('/api/responses/export', (req, res) => {
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
  console.log(`Survey:   http://localhost:${PORT}/survey.html`);
  console.log(`Resultaten: http://localhost:${PORT}/results.html\n`);
});
