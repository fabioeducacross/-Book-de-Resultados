const fs = require('fs');
const path = require('path');

module.exports = async function globalSetup() {
    const runtimeFile = path.resolve(
        __dirname,
        '../../../packages/book-de-resultados/examples/.runtime/audit-runs.json',
    );
    if (fs.existsSync(runtimeFile)) {
        fs.unlinkSync(runtimeFile);
    }
};
