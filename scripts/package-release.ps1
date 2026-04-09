param(
  [string]$VersionOverride = ""
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot

$manifestPath = Join-Path $repoRoot "manifest.json"
if (-not (Test-Path $manifestPath)) {
  throw "manifest.json not found"
}

$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
$version = if ([string]::IsNullOrWhiteSpace($VersionOverride)) { $manifest.version } else { $VersionOverride }

$releaseBase = "ZN-blocker-v$version"
$distDir = Join-Path $repoRoot "dist"
if (-not (Test-Path $distDir)) {
  New-Item -Path $distDir -ItemType Directory | Out-Null
}

$targets = @("chrome", "edge", "chromium")
$releaseFiles = @()

foreach ($target in $targets) {
  $stageDir = Join-Path $env:TEMP ("zn-blocker-stage-" + [guid]::NewGuid().ToString("N"))
  New-Item -Path $stageDir -ItemType Directory | Out-Null

  Copy-Item (Join-Path $repoRoot "manifest.json") $stageDir
  Copy-Item (Join-Path $repoRoot "LICENSE") $stageDir
  Copy-Item (Join-Path $repoRoot "README.md") $stageDir
  Copy-Item (Join-Path $repoRoot "assets") (Join-Path $stageDir "assets") -Recurse
  Copy-Item (Join-Path $repoRoot "src") (Join-Path $stageDir "src") -Recurse

  $stageRulesDir = Join-Path $stageDir "rules"
  New-Item -Path $stageRulesDir -ItemType Directory | Out-Null
  Copy-Item (Join-Path $repoRoot "rules\youtube-core.json") $stageRulesDir
  Copy-Item (Join-Path $repoRoot "rules\easyprivacy-global.json") $stageRulesDir
  Copy-Item (Join-Path $repoRoot "rules\easyprivacy-global.meta.json") $stageRulesDir

  $zipName = "$releaseBase-$target.zip"
  $zipPath = Join-Path $distDir $zipName
  if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
  }

  Compress-Archive -Path (Join-Path $stageDir "*") -DestinationPath $zipPath -CompressionLevel Optimal
  $releaseFiles += $zipPath

  Remove-Item $stageDir -Recurse -Force
  Write-Output "Packed $zipName"
}

$hashFile = Join-Path $distDir "$releaseBase-SHA256SUMS.txt"
$hashLines = @()

foreach ($file in $releaseFiles) {
  $hash = (Get-FileHash -Path $file -Algorithm SHA256).Hash.ToLowerInvariant()
  $name = Split-Path $file -Leaf
  $hashLines += "$hash  $name"
}

Set-Content -Path $hashFile -Value $hashLines -Encoding UTF8
Write-Output "Wrote $(Split-Path $hashFile -Leaf)"
