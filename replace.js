const fs = require('fs');
const path = 'c:/Users/Educacross/Documents/Projetos Educacross/-Book-de-Resultados/packages/book-de-resultados/src/html-renderer.js';
let content = fs.readFileSync(path, 'utf8');

const regex = /\.school-participation-stars \s*\{[\s\S]*?\}/;
console.log('Regex test:', regex.test(content));

const b64 = Buffer.from(fs.readFileSync('test.svg')).toString('base64');
const newImage = "url('data:image/svg+xml;base64," + b64 + "'), url('data:image/svg+xml;base64," + b64 + "')";

const replacement = `.school-participation-stars {
        display: flex;
        width: 6.8mm;
        height: 16.5mm;
        margin-bottom: 2mm;
        margin-left: -1mm;
        background-image: ${newImage};
        background-repeat: no-repeat;
        background-position: top center, bottom center;
        background-size: 100% 45%, 100% 45%;
    }`;

content = content.replace(regex, replacement);
fs.writeFileSync(path, content);
console.log('Done replacement.');
