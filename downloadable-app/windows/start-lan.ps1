$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$backendRoot = Join-Path $projectRoot "backend"
$python = Join-Path $backendRoot ".venv\Scripts\python.exe"
$node = (Get-Command node -ErrorAction Stop).Source
$electronCli = Join-Path $projectRoot "node_modules\electron\cli.js"
$bridge = Join-Path $PSScriptRoot "lan-bridge.mjs"
$requiredPaths = @(
  $python,
  $electronCli,
  $bridge,
  (Join-Path $projectRoot "dist\server\server.js"),
  (Join-Path $projectRoot "inspector-portal\dist\index.html")
)

foreach ($requiredPath in $requiredPaths) {
  if (-not (Test-Path $requiredPath)) {
    throw "Required app file not found: $requiredPath. Follow downloadable-app\README.md."
  }
}

$defaultRoutes = Get-NetRoute -DestinationPrefix "0.0.0.0/0" -ErrorAction SilentlyContinue
$routeIndexes = @($defaultRoutes | Select-Object -ExpandProperty InterfaceIndex -Unique)
$lanAddresses = @(
  Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
    Where-Object {
      $routeIndexes -contains $_.InterfaceIndex -and
      $_.IPAddress -notlike "127.*" -and
      $_.IPAddress -notlike "169.254.*"
    } |
    Select-Object -ExpandProperty IPAddress -Unique
)

if ($lanAddresses.Count -ne 1) {
  throw "Expected one active Wi-Fi/LAN IPv4 address; found $($lanAddresses -join ', '). Disconnect extra VPN/network adapters and retry."
}

$lanHost = $lanAddresses[0]
$ports = @(8000, 4175, 4176, 5173, 5174)
$occupied = @(
  Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
    Where-Object { $ports -contains $_.LocalPort }
)
if ($occupied.Count -gt 0) {
  $details = $occupied | ForEach-Object { "$($_.LocalPort) (PID $($_.OwningProcess))" }
  throw "Required app ports are already in use: $($details -join ', '). Stop those services and retry."
}

$oldOrigins = $env:ALLOWED_ORIGINS
$oldTrustedHosts = $env:TRUSTED_HOSTS
$oldLanHost = $env:SATARK_LAN_HOST
$children = [System.Collections.Generic.List[System.Diagnostics.Process]]::new()

try {
  $env:ALLOWED_ORIGINS = "http://$lanHost`:5173,http://$lanHost`:5174,http://localhost:4175,http://127.0.0.1:4175,http://localhost:4176,http://127.0.0.1:4176"
  $env:TRUSTED_HOSTS = "localhost,127.0.0.1,$lanHost"
  $env:SATARK_LAN_HOST = $lanHost

  $backend = Start-Process -FilePath $python `
    -ArgumentList @("-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000") `
    -WorkingDirectory $backendRoot -PassThru -NoNewWindow
  $children.Add($backend)

  $desktop = Start-Process -FilePath $node `
    -ArgumentList @($electronCli, ".") `
    -WorkingDirectory $projectRoot -PassThru -NoNewWindow
  $children.Add($desktop)

  $lanBridge = Start-Process -FilePath $node `
    -ArgumentList @($bridge) `
    -WorkingDirectory $projectRoot -PassThru -NoNewWindow
  $children.Add($lanBridge)
}
catch {
  foreach ($child in $children) {
    $child.Refresh()
    if (-not $child.HasExited) {
      Stop-Process -Id $child.Id -ErrorAction SilentlyContinue
    }
  }
  throw
}
finally {
  $env:ALLOWED_ORIGINS = $oldOrigins
  $env:TRUSTED_HOSTS = $oldTrustedHosts
  $env:SATARK_LAN_HOST = $oldLanHost
}

Write-Host ""
Write-Host "Satark Drishti is starting."
Write-Host "Authority: http://${lanHost}:5173"
Write-Host "Inspector: http://${lanHost}:5174"
Write-Host "Keep this window open. Press Ctrl+C to stop the services."

try {
  while ($true) {
    foreach ($child in $children) {
      $child.Refresh()
      if ($child.HasExited) {
        throw "A Satark Drishti service exited (PID $($child.Id), code $($child.ExitCode))."
      }
    }
    Start-Sleep -Seconds 1
  }
}
finally {
  foreach ($child in $children) {
    $child.Refresh()
    if (-not $child.HasExited) {
      if (-not $child.CloseMainWindow()) {
        Stop-Process -Id $child.Id -ErrorAction SilentlyContinue
      }
    }
  }
  foreach ($child in $children) {
    if (-not $child.HasExited) {
      if (-not $child.WaitForExit(5000)) {
        Stop-Process -Id $child.Id -ErrorAction SilentlyContinue
      }
    }
  }
}
