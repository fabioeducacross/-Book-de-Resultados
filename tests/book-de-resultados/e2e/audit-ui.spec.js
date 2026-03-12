// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { makeCanoasXlsx } = require('./fixtures/make-canoas-xlsx');

// XLSX file created once per suite in beforeAll, cleaned up in afterAll
let xlsxPath = '';

test.describe.serial('Audit UI - upload, listagem e exportação', () => {
    test.beforeAll(async ({ request }) => {
        // Reset the server to exactly 4 seeds — survives re-runs and reused servers
        const res = await request.post('http://127.0.0.1:3210/api/audit/_reset');
        if (!res.ok()) throw new Error(`Store reset failed: ${res.status()}`);
        xlsxPath = await makeCanoasXlsx();
    });

    test.afterAll(() => {
        if (xlsxPath && fs.existsSync(xlsxPath)) {
            fs.unlinkSync(xlsxPath);
        }
    });

    // ── 1. Smoke ─────────────────────────────────────────────────────────────────
    test('1 · carregamento inicial: summary strip, api status e tabela com seeds', async ({ page }) => {
        await page.goto('/');

        // API status must say "conectada" after loadRuns() completes
        const apiStatus = page.locator('#apiStatus');
        await expect(apiStatus).toContainText('API conectada:', { timeout: 10000 });

        // summaryStrip populated from seed data (4 runs: 2 Sucesso, 1 Parcial, 1 Erro)
        const strip = page.locator('#summaryStrip');
        await expect(strip).toContainText('Total de logs: 4');
        await expect(strip).toContainText('Sucesso: 2');
        await expect(strip).toContainText('Parcial: 1');
        await expect(strip).toContainText('Erro: 1');

        // Table must have 4 rows from seed data
        const rows = page.locator('#runsTableBody tr');
        await expect(rows).toHaveCount(4);

        // Audit detail section was intentionally removed from this screen
        await expect(page.locator('#auditTimeline')).toHaveCount(0);
    });

    // ── 2. Importação feliz ───────────────────────────────────────────────────────
    test('2 · importação: enviar XLSX válido e verificar nova linha na tabela', async ({ page }) => {
        await page.goto('/');
        // Wait until the page is ready
        await expect(page.locator('#apiStatus')).toContainText('API conectada:', { timeout: 10000 });

        // Set owner and format
        await page.locator('#ownerInput').fill('QA E2E Playwright');
        await page.locator('#formatInput').selectOption('json');

        // Set the hidden file input directly — avoids OS-level dialogs
        await page.locator('#bookFileInput').setInputFiles(xlsxPath);

        // Feedback should appear after the automatic processing starts
        const feedback = page.locator('#uploadFeedback');
        await expect(feedback).toHaveClass(/is-visible/, { timeout: 5000 });

        // Wait for the processing to finish (feedback changes from loading to success or loading-partial)
        await expect(feedback).toContainText('Processamento concluído', { timeout: 45000 });

        // After generation, loadRuns() refreshes the table — expect 5 rows now
        const rows = page.locator('#runsTableBody tr');
        await expect(rows).toHaveCount(5, { timeout: 10000 });

        // New runs are inserted with unshift — newest run is at the top (first row)
        const firstRow = rows.first();
        await expect(firstRow).toContainText('QA E2E Playwright');

        // Summary strip must reflect the new total
        await expect(page.locator('#summaryStrip')).toContainText('Total de logs: 5');
    });

    // ── 3. Detalhe da execução ────────────────────────────────────────────────────
    test('3 · ação visualizar: clicar no ícone abre o modal de detalhes', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#apiStatus')).toContainText('API conectada:', { timeout: 10000 });

        const viewBtn = page.locator('#runsTableBody [data-action="view"]').first();
        await viewBtn.click();

        // Modal should be visible with run details
        const modal = page.locator('#runDetailModal');
        await expect(modal).toHaveClass(/is-open/);
        await expect(page.locator('#modalFileName')).not.toHaveText('—');
        await expect(page.locator('#modalOwner')).not.toHaveText('—');

        // Download and preview buttons should exist
        await expect(page.locator('#modalDownloadBtn')).toBeVisible();
        await expect(page.locator('#modalPreviewBtn')).toBeVisible();

        // Close the modal
        await page.locator('#modalCloseBtn').click();
        await expect(modal).not.toHaveClass(/is-open/);

        // Table should remain stable
        await expect(page.locator('#runsTableBody tr')).toHaveCount(5);
    });

    // ── 4. Exportação da listagem ─────────────────────────────────────────────────
    test('4 · exportação: baixar JSON e verificar conteúdo', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#apiStatus')).toContainText('API conectada:', { timeout: 10000 });
        await expect(page.locator('#runsTableBody tr')).toHaveCount(5, { timeout: 10000 });

        // Intercept the download triggered by the export button
        const [download] = await Promise.all([
            page.waitForEvent('download'),
            page.locator('#exportRunsButton').click(),
        ]);

        // Verify file name
        expect(download.suggestedFilename()).toBe('auditoria-book-de-resultados.json');

        // Read and parse the downloaded JSON
        const savePath = path.join(require('os').tmpdir(), `audit-export-${Date.now()}.json`);
        await download.saveAs(savePath);
        const contents = JSON.parse(fs.readFileSync(savePath, 'utf8'));
        fs.unlinkSync(savePath);

        // Should have at least 5 runs (4 seeds + 1 from test 2)
        expect(Array.isArray(contents)).toBe(true);
        expect(contents.length).toBeGreaterThanOrEqual(5);

        // Each item should have id, fileName, status
        for (const item of contents) {
            expect(item).toHaveProperty('id');
            expect(item).toHaveProperty('fileName');
            expect(item).toHaveProperty('status');
        }
    });

    // ── 5. Filtros ────────────────────────────────────────────────────────────────
    test('5 · filtros: filtrar por autor reduz a tabela corretamente', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#apiStatus')).toContainText('API conectada:', { timeout: 10000 });

        await expect(page.locator('#ownerSearchInput')).toContainText('QA E2E Playwright', { timeout: 5000 });
        await page.locator('#ownerSearchInput').selectOption('QA E2E Playwright');
        await page.locator('#applyFiltersButton').click();

        // Filtered result should reduce the table to a non-empty author subset
        const rows = page.locator('#runsTableBody tr');
        await expect(rows).toHaveCount(1, { timeout: 5000 });
        await expect(rows.first()).toContainText('QA E2E Playwright');

        // Export filtered result — should contain only runs by the selected author
        const [download] = await Promise.all([
            page.waitForEvent('download'),
            page.locator('#exportRunsButton').click(),
        ]);
        const savePath = path.join(require('os').tmpdir(), `audit-export-filtered-${Date.now()}.json`);
        await download.saveAs(savePath);
        const items = JSON.parse(fs.readFileSync(savePath, 'utf8'));
        fs.unlinkSync(savePath);
        expect(items).toHaveLength(1);
        expect(items.every((item) => item.owner === 'QA E2E Playwright')).toBe(true);

        // Clear filters programmatically
        await page.evaluate(() => {
            clearFilters();
            return loadRuns();
        });
        const allRowsCount = await page.locator('#runsTableBody tr').count();
        expect(allRowsCount).toBeGreaterThan(1);
    });

    test('5.1 · filtros: filtrar por operação e registro reduz a tabela corretamente', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#apiStatus')).toContainText('API conectada:', { timeout: 10000 });

        await page.evaluate(() => {
            const operacaoInput = document.getElementById('operacao');
            if (!(operacaoInput instanceof HTMLSelectElement)) {
                throw new Error('Campo de operação não encontrado.');
            }
            operacaoInput.value = 'Atualização de Licenças';
            operacaoInput.dispatchEvent(new Event('change', { bubbles: true }));
        });
        await expect(page.locator('#runsTableBody tr')).toHaveCount(1, { timeout: 5000 });
        await expect(page.locator('#runsTableBody tr').first()).toContainText('licencas_rede_abc.xlsx');

        await page.evaluate(() => {
            clearFilters();
            return loadRuns();
        });
        await page.evaluate(() => {
            const registroInput = document.getElementById('registro');
            if (!(registroInput instanceof HTMLInputElement)) {
                throw new Error('Campo de registro não encontrado.');
            }
            registroInput.value = 'diagnostico';
            registroInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        });

        await expect(page.locator('#runsTableBody tr')).toHaveCount(1, { timeout: 5000 });
        await expect(page.locator('#runsTableBody tr').first()).toContainText('diagnostico_turma_5A.xlsx');
    });

    // ── 6. Paginação ──────────────────────────────────────────────────────────────
    test('6 · paginação: info de contagem correta e navegação entre páginas', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#apiStatus')).toContainText('API conectada:', { timeout: 10000 });

        // With 5 runs and default pageSize=5, pagination shows 1 page
        const paginationInfo = page.locator('#paginationInfo');
        await expect(paginationInfo).toContainText('de 5', { timeout: 10000 });

        // Force pageSize=2 via JS so we can test multi-page navigation
        await page.evaluate(() => {
            /* global state, loadRuns */
            state.pageSize = 2;
            return loadRuns();
        });

        // Should now show 2 items and indicate there are 5 total
        await expect(paginationInfo).toContainText('1–2');
        await expect(paginationInfo).toContainText('de 5');

        // Page 2 button must be present.
        // NOTE: the "next" chevron also has data-page="2" when on page 1,
        // so we filter by text content to get only the numeric page 2 button.
        const page2Btn = page.locator('#paginationControls [data-page="2"]').filter({ hasText: /^2$/ });
        await expect(page2Btn).toBeVisible();

        // Navigate to page 2
        await page2Btn.click();
        await expect(paginationInfo).toContainText('3–4', { timeout: 5000 });

        // Page 1 button should no longer be "active"
        const page1Btn = page.locator('#paginationControls [data-page="1"]').filter({ hasText: /^1$/ });
        await expect(page1Btn).not.toHaveClass(/active/);
        // Page 2 numeric button should be "active"
        await expect(page2Btn).toHaveClass(/active/);

        // Navigate back to page 1
        await page1Btn.click();
        await expect(paginationInfo).toContainText('1–2', { timeout: 5000 });
    });

    // ── 7. Envio sem arquivo ──────────────────────────────────────────────────────
    test('7 · validação: gerar sem arquivo via API da página exibe toast de erro', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#apiStatus')).toContainText('API conectada:', { timeout: 10000 });

        await page.evaluate(async () => {
            try {
                await generateBookFromSelectedFile();
            } catch (_) {
                // O feedback de erro é validado fora do evaluate.
            }
        });

        const toast = page.locator('#appToast');
        await expect(toast).toHaveClass(/is-visible/, { timeout: 5000 });
        await expect(toast).toContainText('Ocorreu um erro');
        await expect(toast).toContainText('Selecione um arquivo XLSX antes de enviar. Tente novamente.');
    });
});
