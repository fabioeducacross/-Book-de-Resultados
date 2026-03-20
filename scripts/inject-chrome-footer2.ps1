$base = "c:\Users\Educacross\Documents\Projetos Educacross\-Book-de-Resultados\packages\book-de-resultados\examples\.runtime\manual-layout-test"
$files = @("relatorio_canoas_2025_2025_sem2_manual.print.html", "relatorio_canoas_2025_2025_sem2_v1.print.html")

foreach ($f in $files) {
  $path = Join-Path $base $f
  $lines = [IO.File]::ReadAllLines($path)
  $insertions = @{}
  
  $i = 0
  while ($i -lt $lines.Length) {
    $line = $lines[$i]
    
    # Find lines with framed-chrome-header (already injected)
    if ($line.Contains('<div class="framed-chrome-header">')) {
      # Go backwards to find the framed-page-meta to extract page number
      $pageNum = ''
      for ($j = $i - 1; $j -ge [Math]::Max(0, $i - 5); $j--) {
        if ($lines[$j] -match 'gina\s+(\d+)') {
          $pageNum = $matches[1]
          break
        }
      }
      
      # Now find the closing </section> for this page
      # The page section opens with <section class="page ...">
      # We need to track nesting: count <section and </section> from here
      $depth = 0
      $foundOpen = $false
      
      # Go back to find the opening <section class="page
      for ($j = $i; $j -ge [Math]::Max(0, $i - 10); $j--) {
        if ($lines[$j] -match '<section\s+class="page\b') {
          $depth = 1
          $foundOpen = $true
          # Now scan forward from $j+1
          for ($k = $j + 1; $k -lt $lines.Length; $k++) {
            # Count section opens and closes
            $opens = ([regex]::Matches($lines[$k], '<section[\s>]')).Count
            $closes = ([regex]::Matches($lines[$k], '</section>')).Count
            $depth = $depth + $opens - $closes
            
            if ($depth -le 0) {
              # This line has the closing </section> for the page
              # Insert footer before this line
              $insertions[$k] = $pageNum
              break
            }
          }
          break
        }
      }
    }
    $i++
  }
  
  # Apply insertions in reverse order
  $sortedKeys = $insertions.Keys | Sort-Object -Descending
  foreach ($lineNum in $sortedKeys) {
    $pageNum = $insertions[$lineNum]
    $footerLines = @(
      "      <div class=`"framed-chrome-footer`">",
      "        <span class=`"framed-chrome-page-number`">$pageNum</span>",
      "      </div>"
    )
    $before = $lines[0..($lineNum - 1)]
    $after = $lines[$lineNum..($lines.Length - 1)]
    $lines = $before + $footerLines + $after
  }
  
  [IO.File]::WriteAllLines($path, $lines)
  $content = [IO.File]::ReadAllText($path)
  $headerCount = ([regex]::Matches($content, '<div class="framed-chrome-header">')).Count
  $footerCount = ([regex]::Matches($content, '<div class="framed-chrome-footer">')).Count
  Write-Host "$f - headers: $headerCount, footers: $footerCount"
}
