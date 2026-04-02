param(
  [string]$Version,
  [string]$Repo = "brentishere41848/pasusminer",
  [string]$Branch = "main"
)

$ErrorActionPreference = "Stop"

function Get-GitHubToken {
  if ($env:GITHUB_TOKEN) {
    return $env:GITHUB_TOKEN
  }

  $filled = @"
protocol=https
host=github.com
username=brentishere41848

"@ | git credential fill

  $passwordLine = $filled | Select-String '^password='
  if (-not $passwordLine) {
    throw "No GitHub token found. Set GITHUB_TOKEN or configure git credential manager."
  }

  return $passwordLine.ToString().Split('=')[1]
}

function Remove-ReleaseAssetIfPresent {
  param(
    [hashtable]$Headers,
    [string]$RepoName,
    [int]$ReleaseId,
    [string]$AssetName
  )

  $assets = Invoke-RestMethod -Headers $Headers -Uri "https://api.github.com/repos/$RepoName/releases/$ReleaseId/assets"
  $asset = $assets | Where-Object { $_.name -eq $AssetName } | Select-Object -First 1
  if ($asset) {
    Invoke-RestMethod -Method Delete -Headers $Headers -Uri "https://api.github.com/repos/$RepoName/releases/assets/$($asset.id)" | Out-Null
  }
}

if (-not $Version) {
  $tauriConfig = Get-Content "src-tauri/tauri.conf.json" | ConvertFrom-Json
  $Version = $tauriConfig.version
}

$tag = "v$Version"
$signingKeyPath = Join-Path $HOME ".tauri\pasus-miner-updater.key"
if (-not (Test-Path $signingKeyPath)) {
  throw "Signing key not found at $signingKeyPath"
}

$env:TAURI_SIGNING_PRIVATE_KEY = $signingKeyPath
if (-not $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD) {
  $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ""
}

npm run tauri:build

$bundleRoot = "src-tauri\target\release\bundle"
$nsisInstaller = Get-ChildItem "$bundleRoot\nsis\*.exe" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
$msiInstaller = Get-ChildItem "$bundleRoot\msi\*.msi" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
$nsisSignature = Get-ChildItem "$bundleRoot\nsis\*.exe.sig" | Sort-Object LastWriteTime -Descending | Select-Object -First 1

if (-not $nsisInstaller -or -not $msiInstaller -or -not $nsisSignature) {
  throw "Expected signed NSIS/MSI artifacts were not generated."
}

New-Item -ItemType Directory -Force "build" | Out-Null

$exeAssetName = "PasusMiner-setup-$tag-x64.exe"
$msiAssetName = "PasusMiner-$tag-x64.msi"
$latestJsonPath = "build\latest.json"
$exeBuildPath = Join-Path "build" $exeAssetName
$msiBuildPath = Join-Path "build" $msiAssetName

Copy-Item $nsisInstaller.FullName $exeBuildPath -Force
Copy-Item $msiInstaller.FullName $msiBuildPath -Force

$releaseBaseUrl = "https://github.com/$Repo/releases/download/$tag"
$signature = (Get-Content $nsisSignature.FullName -Raw).Trim()
$latestJson = [ordered]@{
  version = $Version
  notes = "Pasus Miner $Version"
  pub_date = (Get-Date).ToUniversalTime().ToString("o")
  platforms = @{
    "windows-x86_64" = @{
      signature = $signature
      url = "$releaseBaseUrl/$exeAssetName"
    }
  }
}
$latestJson | ConvertTo-Json -Depth 6 | Set-Content $latestJsonPath

git push origin $Branch
git tag -f $tag
git push origin $tag --force

$token = Get-GitHubToken
$headers = @{
  Authorization = "token $token"
  "User-Agent" = "PasusMiner-Release"
  Accept = "application/vnd.github+json"
}

$release = $null
try {
  $release = Invoke-RestMethod -Headers $headers -Uri "https://api.github.com/repos/$Repo/releases/tags/$tag"
} catch {
  $payload = @{
    tag_name = $tag
    target_commitish = $Branch
    name = $tag
    body = @"
Pasus Miner $tag

Release assets:
- Windows NSIS installer
- Windows MSI installer
- latest.json for the built-in Tauri updater
"@
    draft = $false
    prerelease = $false
  } | ConvertTo-Json

  $release = Invoke-RestMethod -Method Post -Headers $headers -Uri "https://api.github.com/repos/$Repo/releases" -Body $payload -ContentType "application/json"
}

Remove-ReleaseAssetIfPresent -Headers $headers -RepoName $Repo -ReleaseId $release.id -AssetName $exeAssetName
Remove-ReleaseAssetIfPresent -Headers $headers -RepoName $Repo -ReleaseId $release.id -AssetName $msiAssetName
Remove-ReleaseAssetIfPresent -Headers $headers -RepoName $Repo -ReleaseId $release.id -AssetName "latest.json"

$binaryHeaders = @{
  Authorization = "token $token"
  "User-Agent" = "PasusMiner-Release"
  Accept = "application/vnd.github+json"
  "Content-Type" = "application/octet-stream"
}

$uploads = @(
  @{ Path = $exeBuildPath; Name = $exeAssetName },
  @{ Path = $msiBuildPath; Name = $msiAssetName },
  @{ Path = $latestJsonPath; Name = "latest.json" }
)

foreach ($asset in $uploads) {
  $uploadUrl = "https://uploads.github.com/repos/$Repo/releases/$($release.id)/assets?name=$([uri]::EscapeDataString($asset.Name))"
  Invoke-RestMethod -Method Post -Headers $binaryHeaders -Uri $uploadUrl -InFile $asset.Path | Out-Null
}

Write-Host "Release published: https://github.com/$Repo/releases/tag/$tag"
