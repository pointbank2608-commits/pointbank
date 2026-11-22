param([string]$InputDirectory,[string]$OutputDirectory)
Add-Type -AssemblyName System.Drawing
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$font = [System.Drawing.Font]::new('Arial',14)
$white = [System.Drawing.Brushes]::White
try {
  foreach ($metadataFile in Get-ChildItem -LiteralPath $InputDirectory -Filter '*.frames.json') {
    $meta = Get-Content -LiteralPath $metadataFile.FullName -Raw | ConvertFrom-Json
    $frameWidth=320; $frameHeight=180; $labelHeight=24; $columns=5; $perPage=25
    for ($offset=0; $offset -lt $meta.frames.Count; $offset+=$perPage) {
      $file=Join-Path $OutputDirectory "$($meta.youtubeId)-$offset.jpg"
      if (Test-Path -LiteralPath $file) {continue}
      $count=[Math]::Min($perPage,$meta.frames.Count-$offset)
      $bitmap=[System.Drawing.Bitmap]::new($columns*$frameWidth,[Math]::Ceiling($count/$columns)*($frameHeight+$labelHeight))
      $graphics=[System.Drawing.Graphics]::FromImage($bitmap)
      try {
        $graphics.Clear([System.Drawing.Color]::Black)
        for ($index=0; $index -lt $count; $index++) {
          $frame=$meta.frames[$offset+$index]
          $sheet=[System.Drawing.Bitmap]::new((Join-Path (Get-Location) $frame.file))
          try {
            $x=($index%$columns)*$frameWidth; $y=[Math]::Floor($index/$columns)*($frameHeight+$labelHeight)
            $destination=[System.Drawing.Rectangle]::new($x,$y,$frameWidth,$frameHeight)
            $graphics.DrawImage($sheet,$destination,$frame.x,$frame.y,$frame.width,$frame.height,[System.Drawing.GraphicsUnit]::Pixel)
            $label=('{0}:{1:00} ({2}s)' -f [Math]::Floor($frame.time/60),($frame.time%60),$frame.time)
            $graphics.DrawString($label,$font,$white,$x+4,$y+$frameHeight)
          } finally {$sheet.Dispose()}
        }
        $bitmap.Save((Join-Path (Get-Location) $file),[System.Drawing.Imaging.ImageFormat]::Jpeg)
      } finally {$graphics.Dispose();$bitmap.Dispose()}
    }
    Write-Output "$($meta.youtubeId) $($meta.frames.Count) exact-time frames"
  }
} finally {$font.Dispose()}
