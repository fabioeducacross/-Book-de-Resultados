const path = require('path');
const { generateBook } = require('./src/index.js');

const xlsx = 'C:\\Users\\Educacross\\Documents\\Projetos Educacross\\-Book-de-Resultados\\tests\\book-de-resultados\\fixtures\\canoas-2025-sem2\\[CANOAS 2025 - 2 Semestre] Proficiência por escola.xlsx';

generateBook({
  inputFile: xlsx,
  outputDir: '.',
  format: 'pdf',
  version: 'v1',
  keepHtml: true,
}).then(r => {
  console.log('OK', JSON.stringify(r.outputFile || r));
}).catch(e => {
  console.error('ERR', e.message);
});
