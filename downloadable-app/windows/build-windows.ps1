$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$packageJson = Join-Path $projectRoot "package.json"
$electronBuilder = Join-Path $projectRoot "node_modules\electron-builder\out\cli\cli.js"
$electronInstall = Join-Path $projectRoot "node_modules\electron\install.js"
$config = Join-Path $PSScriptRoot "electron-builder.yml"
$npmCli = Join-Path (Split-Path (Get-Command node -ErrorAction Stop).Source -Parent) `
  "node_modules\npm\bin\npm-cli.js"

foreach ($requiredPath in @($packageJson, $electronBuilder, $electronInstall, $npmCli, $config)) {
  if (-not (Test-Path $requiredPath)) {
    throw "Required build file not found: $requiredPath. Run npm install from the project root first."
  }
}

$nodeExecutable = (& npx --yes --package=node@22.12.0 -- node -p "process.execPath").Trim()
if ($LASTEXITCODE -ne 0 -or -not (Test-Path $nodeExecutable)) {
  throw "Could not prepare the Node.js 22 runtime required by Vite and Electron."
}
$nodeDirectory = Split-Path $nodeExecutable -Parent
$oldPath = $env:Path
$env:Path = "$nodeDirectory;$oldPath"

Push-Location $projectRoot
try {
  Write-Host "Preparing the Electron desktop runtime..."
  & $nodeExecutable $electronInstall
  if ($LASTEXITCODE -ne 0) {
    throw "Electron runtime download failed with exit code $LASTEXITCODE."
  }

  Write-Host "Building the Authority and Inspector web apps..."
  & $nodeExecutable $npmCli run build
  if ($LASTEXITCODE -ne 0) {
    throw "The Authority web app build failed with exit code $LASTEXITCODE."
  }

  & $nodeExecutable $npmCli run build --prefix inspector-portal
  if ($LASTEXITCODE -ne 0) {
    throw "The Inspector web app build failed with exit code $LASTEXITCODE."
  }

  Write-Host "Packaging the Windows installer into downloadable-app\releases\windows..."
  & $nodeExecutable $electronBuilder build --win nsis --config $config
  if ($LASTEXITCODE -ne 0) {
    throw "The Windows installer build failed with exit code $LASTEXITCODE."
  }

  $installer = Get-ChildItem (Join-Path $projectRoot "downloadable-app\releases\windows") `
    -Filter "*Setup*.exe" -File -ErrorAction SilentlyContinue |
    Select-Object -First 1
  if (-not $installer) {
    throw "Packaging completed, but no Windows setup executable was found."
  }
  Write-Host "Windows installer ready: $($installer.FullName)"
}
finally {
  Pop-Location
  $env:Path = $oldPath
}
