// @ts-check
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './tests',
    testMatch: '**/e2e/**/*.spec.js',
    timeout: 60000,
    // Runs serially — the server uses a shared on-disk store
    workers: 1,
    use: {
        baseURL: 'http://127.0.0.1:3210',
        acceptDownloads: true,
    },
    // Delete the store before the webServer is started so each run starts clean
    globalSetup: require.resolve('./tests/book-de-resultados/e2e/global-setup.js'),
    webServer: {
        command: 'node packages/book-de-resultados/examples/upload-listagem-auditoria-server.js',
        port: 3210,
        // Reuse a running server locally to avoid port conflicts on Windows.
        // The spec's beforeAll calls POST /api/audit/_reset to ensure clean state.
        reuseExistingServer: !process.env.CI,
        timeout: 30000,
    },
    reporter: [['list'], ['html', { open: 'never' }]],
});
