$base = "c:\Users\Educacross\Documents\Projetos Educacross\-Book-de-Resultados\packages\book-de-resultados\examples\.runtime\manual-layout-test"
$files = @("relatorio_canoas_2025_2025_sem2_manual.print.html", "relatorio_canoas_2025_2025_sem2_v1.print.html")

foreach ($f in $files) {
  $path = Join-Path $base $f
  $c = [IO.File]::ReadAllText($path)
  
  # Strategy: find each chrome-header, extract page number from preceding meta,
  # then find the matching page-level </section> by scanning for the next 
  # <section that starts a new page (class="page) or end of document.
  # The </section> just before that is our target.
  
  $headerTag = '<div class="framed-chrome-header">'
  $insertions = [System.Collections.ArrayList]::new()
  
  $searchFrom = 0
  while (($headerPos = $c.IndexOf($headerTag, $searchFrom)) -ge 0) {
    # Extract page number from framed-page-meta before this header
    $metaEnd = $headerPos
    $metaStart = $c.LastIndexOf('framed-page-meta', $metaEnd)
    $pageNum = ''
    if ($metaStart -ge 0) {
      $chunk = $c.Substring($metaStart, [Math]::Min(300, $c.Length - $metaStart))
      if ($chunk -match 'gina\s+(\d+)') {
        $pageNum = $matches[1]
      }
    }
    
    # Find the next page section start (or end of body/document)
    $nextPageStart = $c.IndexOf('<section', $headerPos + $headerTag.Length + 100)
    # But this finds inner sections too. We need to find `<section` followed by `class="page`
    $scanFrom = $headerPos + $headerTag.Length
    $nextPageSection = -1
    
    while ($true) {
      $nextSec = $c.IndexOf("`n  <section", $scanFrom)
      if ($nextSec -lt 0) { break }
      # Check if this section has class="page" within next 500 chars
      $secChunk = $c.Substring($nextSec, [Math]::Min(500, $c.Length - $nextSec))
      if ($secChunk -match 'class="page\b') {
        $nextPageSection = $nextSec
        break
      }
      $scanFrom = $nextSec + 10
    }
    
    # Find the last </section> before the next page section (or end of body)
    $boundary = if ($nextPageSection -gt 0) { $nextPageSection } else { $c.Length }
    
    # Find the last </section> before boundary
    $lastClose = $c.LastIndexOf('</section>', $boundary - 1)
    if ($lastClose -gt $headerPos) {
      $footer = "`n      <div class=`"framed-chrome-footer`">`n        <span class=`"framed-chrome-page-number`">$pageNum</span>`n      </div>"
      [void]$insertions.Add(@{ Position = $lastClose; Text = $footer; Page = $pageNum })
    }
    
    $searchFrom = $headerPos + $headerTag.Length
  }
  
  # Apply in reverse order
  $insertions = $insertions | Sort-Object { $_.Position } -Descending
  foreach ($ins in $insertions) {
    $c = $c.Insert($ins.Position, $ins.Text)
  }
  
  [IO.File]::WriteAllText($path, $c)
  $headerCount = ([regex]::Matches($c, '<div class="framed-chrome-header">')).Count
  $footerCount = ([regex]::Matches($c, '<div class="framed-chrome-footer">')).Count
  Write-Host "$f - headers: $headerCount, footers: $footerCount"
}
