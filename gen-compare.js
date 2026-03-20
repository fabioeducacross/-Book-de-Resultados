const fs = require('fs');
const s = fs.readFileSync(process.argv[2] || 'escola-summary-edgar.png').toString('base64');
const d = fs.readFileSync(process.argv[3] || 'escola-disciplinas-edgar.png').toString('base64');
const out = process.argv[4] || 'compare.html';
const html = `<!DOCTYPE html><html><head><style>
body{margin:0;background:#333;display:flex;gap:8px;padding:8px;align-items:flex-start}
.img-wrap{background:white;border:2px solid #666}
img{display:block;max-width:none}
h3{color:white;text-align:center;font:bold 12px sans-serif;margin:0 0 4px}
</style></head><body>
<div class="img-wrap"><h3>Escola Summary</h3><img src="data:image/png;base64,${s}" style="height:680px;width:auto"></div>
<div class="img-wrap"><h3>Escola Disciplinas</h3><img src="data:image/png;base64,${d}" style="height:680px;width:auto"></div>
</body></html>`;
fs.writeFileSync(out, html);
console.log('OK ->', out);
