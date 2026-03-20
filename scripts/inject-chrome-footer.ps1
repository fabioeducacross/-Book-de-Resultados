$base = "c:\Users\Educacross\Documents\Projetos Educacross\-Book-de-Resultados\packages\book-de-resultados\examples\.runtime\manual-layout-test"
$files = @("relatorio_canoas_2025_2025_sem2_manual.print.html", "relatorio_canoas_2025_2025_sem2_v1.print.html")

foreach ($f in $files) {
    $path = Join-Path $base $f
    $c = [IO.File]::ReadAllText($path)

    # Add footer only in sections that contain page-content-framed
    # Pattern: closing </div> of page-content-framed followed by newline+space then </section>
    # The page-content-framed div ends with "    </div>" and the section ends with "  </section>"
    # We need to find the closing of framed page-content and add footer between it and </section>
  
    # Match the close of page-content-framed: look for </div> that is followed by </section> 
    # within framed sections (those that have framed-chrome-header already)
  
    # Strategy: find each framed-chrome-header, then find the nearest </section> after it,
    # and insert footer before that </section>
  
    $headerPattern = '<div class="framed-chrome-header">'
    $sectionClose = '</section>'
  
    $offset = 0
    $insertions = @()
  
    while (($idx = $c.IndexOf($headerPattern, $offset)) -ge 0) {
        # Find the </section> that closes this framed page
        $sectionEnd = $c.IndexOf($sectionClose, $idx)
        if ($sectionEnd -ge 0) {
            # Extract page number from the chrome header area
            $metaStart = $c.LastIndexOf('framed-page-meta', $idx)
            $pageNum = ''
            if ($metaStart -ge 0) {
                $metaChunk = $c.Substring($metaStart, [Math]::Min(200, $c.Length - $metaStart))
                if ($metaChunk -match 'gina\s+(\d+)') {
                    $pageNum = $matches[1]
                }
            }
      
            $footer = "`n      <div class=`"framed-chrome-footer`">`n        <span class=`"framed-chrome-page-number`">$pageNum</span>`n      </div>"
            $insertions += @{ Position = $sectionEnd; Text = $footer }
        }
        $offset = $idx + $headerPattern.Length
    }
  
    # Apply insertions in reverse order so positions don't shift
    $insertions = $insertions | Sort-Object { $_.Position } -Descending
    foreach ($ins in $insertions) {
        $c = $c.Insert($ins.Position, $ins.Text)
    }
  
    [IO.File]::WriteAllText($path, $c)
    $headerCount = ([regex]::Matches($c, '<div class="framed-chrome-header">')).Count
    $footerCount = ([regex]::Matches($c, '<div class="framed-chrome-footer">')).Count
    Write-Host "$f - headers: $headerCount, footers: $footerCount"
}
