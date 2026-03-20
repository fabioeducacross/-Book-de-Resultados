$base = "c:\Users\Educacross\Documents\Projetos Educacross\-Book-de-Resultados\packages\book-de-resultados\examples\.runtime\manual-layout-test"
$files = @("relatorio_canoas_2025_2025_sem2_manual.print.html", "relatorio_canoas_2025_2025_sem2_v1.print.html")

foreach ($f in $files) {
    $path = Join-Path $base $f
    $c = [IO.File]::ReadAllText($path)

    # Pattern: after framed-page-meta closing tag, before page-content div
    $pattern = '(<div class="framed-page-meta sr-only">([^<]+)</div>\s*\n\s*)(<div class="page-content page-content-framed">)'
  
    $c = [regex]::Replace($c, $pattern, {
            param($m)
            $metaText = $m.Groups[2].Value.Trim()
            $parts = $metaText -split ' \u2022 '
            $sectionLabel = if ($parts.Length -gt 0) { $parts[0].Trim() } else { '' }
    
            # Extract page number
            $pageNum = ''
            if ($metaText -match 'gina\s+(\d+)') { $pageNum = $matches[1] }
    
            $header = "      <div class=`"framed-chrome-header`">`n        <span>$sectionLabel</span>`n        <span>Canoas `u2022 2025 `u2022 Sem2 `u2022 v1</span>`n      </div>`n"
            $footer = "      <div class=`"framed-chrome-footer`">`n        <span class=`"framed-chrome-page-number`">$pageNum</span>`n      </div>`n"
    
            return $m.Groups[1].Value + $header + "      " + $m.Groups[3].Value
        })
  
    # Add footer before each framed section's closing tag
    # Pattern: end of page-content-framed div, then </section>
    $footerPattern = '(    </div>\r?\n\s*)(  </section>)'
    $c = [regex]::Replace($c, $footerPattern, {
            param($m)
            # We need to only match framed sections. Check if there's page-content-framed nearby.
            # Since this is the generic pattern, we'll add footers to ALL sections that have this pattern.
            # The CSS will hide it for .section-escola anyway.
            return $m.Groups[1].Value + "      <div class=`"framed-chrome-footer`">`n        <span class=`"framed-chrome-page-number`"></span>`n      </div>`n" + "  " + $m.Groups[2].Value
        })
  
    [IO.File]::WriteAllText($path, $c)
    $htmlCount = ([regex]::Matches($c, '<div class="framed-chrome-header">')).Count
    $footerCount = ([regex]::Matches($c, '<div class="framed-chrome-footer">')).Count
    Write-Host "$f - headers: $htmlCount, footers: $footerCount"
}
