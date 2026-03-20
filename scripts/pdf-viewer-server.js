const http = require('http');
const fs = require('fs');

const pdfPath = 'C:/Users/Educacross/Downloads/RelatórioDigitaldeAvaliação_Canoas_2025_SegundoSemestre.pdf';

const html = `<!DOCTYPE html>
<html>
<head>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
</head>
<body style="margin:0;background:#888;display:flex;justify-content:center">
<canvas id="c"></canvas>
<script>
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
async function renderPage(n) {
  const d = await pdfjsLib.getDocument('/pdf').promise;
  const p = await d.getPage(n);
  const s = 2;
  const v = p.getViewport({ scale: s });
  const c = document.getElementById('c');
  c.width = v.width;
  c.height = v.height;
  await p.render({ canvasContext: c.getContext('2d'), viewport: v }).promise;
  document.title = 'PDF Page ' + n + ' of ' + d.numPages;
}
renderPage(parseInt(location.hash.slice(1)) || 1);
window.addEventListener('hashchange', () => renderPage(parseInt(location.hash.slice(1)) || 1));
</script>
</body>
</html>`;

const server = http.createServer((req, res) => {
  if (req.url === '/pdf') {
    res.setHeader('Content-Type', 'application/pdf');
    fs.createReadStream(pdfPath).pipe(res);
  } else {
    res.setHeader('Content-Type', 'text/html');
    res.end(html);
  }
});

server.listen(9877, () => console.log('PDF viewer on http://127.0.0.1:9877'));
