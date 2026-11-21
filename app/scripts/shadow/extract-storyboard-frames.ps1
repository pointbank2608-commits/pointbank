param([string]$InputDirectory,[string]$OutputDirectory)
Add-Type -AssemblyName System.Drawing
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
foreach($metaFile in Get-ChildItem -LiteralPath $InputDirectory -Filter '*.frames.json'){
  $meta=Get-Content -LiteralPath $metaFile.FullName -Raw|ConvertFrom-Json
  $sheet=$null;$currentFile=''
  try{
    for($index=0;$index -lt $meta.frames.Count;$index++){
      $frame=$meta.frames[$index];$file=Join-Path $OutputDirectory "$($meta.youtubeId)-frame-$index.jpg"
      if(Test-Path -LiteralPath $file){continue}
      if($currentFile -ne $frame.file){if($sheet){$sheet.Dispose()};$sheet=[System.Drawing.Bitmap]::new((Join-Path (Get-Location) $frame.file));$currentFile=$frame.file}
      $crop=$sheet.Clone([System.Drawing.Rectangle]::new($frame.x,$frame.y,$frame.width,$frame.height),$sheet.PixelFormat)
      try{$crop.Save((Join-Path (Get-Location) $file),[System.Drawing.Imaging.ImageFormat]::Jpeg)}finally{$crop.Dispose()}
    }
  }finally{if($sheet){$sheet.Dispose()}}
  Write-Output "$($meta.youtubeId) source frames extracted"
}
