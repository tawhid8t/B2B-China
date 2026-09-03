param(
  [switch]$VerifyOnly
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$referenceRoot = [System.IO.Path]::GetFullPath($PSScriptRoot)
$referencePrefix = $referenceRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
$manifestPath = Join-Path $referenceRoot "manifest.json"
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json

function Resolve-ReferencePath([string]$relativePath) {
  $fullPath = [System.IO.Path]::GetFullPath((Join-Path $referenceRoot $relativePath))
  if (-not $fullPath.StartsWith($referencePrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Reference path leaves the approved reference directory: $relativePath"
  }
  return $fullPath
}

$originalsById = @{}
foreach ($original in $manifest.originals) {
  $path = Resolve-ReferencePath $original.file
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
    throw "Missing original: $($original.file)"
  }

  $hash = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash
  if ($hash -ne $original.sha256) {
    throw "SHA-256 mismatch for $($original.file). Expected $($original.sha256), received $hash."
  }

  $image = [System.Drawing.Image]::FromFile($path)
  try {
    if ($image.Width -ne $original.width -or $image.Height -ne $original.height) {
      throw "Dimension mismatch for $($original.file). Expected $($original.width)x$($original.height), received $($image.Width)x$($image.Height)."
    }
  }
  finally {
    $image.Dispose()
  }

  $originalsById[$original.originalId] = $original
}

if ($manifest.screens.Count -ne $manifest.screenCount) {
  throw "Screen count mismatch. Manifest declares $($manifest.screenCount) but contains $($manifest.screens.Count)."
}

$screenIds = @{}
foreach ($screen in $manifest.screens) {
  if ($screenIds.ContainsKey($screen.screenId)) {
    throw "Duplicate screenId: $($screen.screenId)"
  }
  $screenIds[$screen.screenId] = $true

  if (-not $originalsById.ContainsKey($screen.source.originalId)) {
    throw "Unknown originalId '$($screen.source.originalId)' for $($screen.screenId)."
  }

  $assetPath = Resolve-ReferencePath $screen.asset
  $crop = $screen.source.crop
  if ($null -eq $crop) {
    $sourcePath = Resolve-ReferencePath $originalsById[$screen.source.originalId].file
    if ($assetPath -ne $sourcePath) {
      throw "Uncropped screen $($screen.screenId) must reference its original asset directly."
    }
    continue
  }

  $source = $originalsById[$screen.source.originalId]
  if ($crop.x -lt 0 -or $crop.y -lt 0 -or $crop.width -le 0 -or $crop.height -le 0) {
    throw "Invalid crop dimensions for $($screen.screenId)."
  }
  if (($crop.x + $crop.width) -gt $source.width -or ($crop.y + $crop.height) -gt $source.height) {
    throw "Crop for $($screen.screenId) exceeds $($source.originalId) bounds."
  }

  if ($VerifyOnly) {
    if (-not (Test-Path -LiteralPath $assetPath -PathType Leaf)) {
      throw "Missing generated crop: $($screen.asset)"
    }
    $generated = [System.Drawing.Image]::FromFile($assetPath)
    try {
      if ($generated.Width -ne $crop.width -or $generated.Height -ne $crop.height) {
        throw "Generated crop dimension mismatch for $($screen.screenId)."
      }
    }
    finally {
      $generated.Dispose()
    }
    continue
  }

  $sourcePath = Resolve-ReferencePath $source.file
  $sourceImage = [System.Drawing.Image]::FromFile($sourcePath)
  $bitmap = New-Object System.Drawing.Bitmap($crop.width, $crop.height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
    $graphics.DrawImage(
      $sourceImage,
      [System.Drawing.Rectangle]::new(0, 0, $crop.width, $crop.height),
      [System.Drawing.Rectangle]::new($crop.x, $crop.y, $crop.width, $crop.height),
      [System.Drawing.GraphicsUnit]::Pixel
    )
    $stream = [System.IO.File]::Open($assetPath, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
    try {
      $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
    }
    finally {
      $stream.Dispose()
    }
  }
  finally {
    $graphics.Dispose()
    $bitmap.Dispose()
    $sourceImage.Dispose()
  }
}

if ($VerifyOnly) {
  Write-Output "Verified $($manifest.originals.Count) originals and $($manifest.screens.Count) registered screens."
}
else {
  $cropCount = @($manifest.screens | Where-Object { $null -ne $_.source.crop }).Count
  Write-Output "Generated $cropCount screen crops after verifying $($manifest.originals.Count) originals."
}

