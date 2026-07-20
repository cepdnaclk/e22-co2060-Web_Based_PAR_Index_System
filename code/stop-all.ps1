$ErrorActionPreference = 'SilentlyContinue'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$pidFile = Join-Path $root '.run-pids.json'

if (Test-Path $pidFile) {
    $pids = Get-Content $pidFile | ConvertFrom-Json
    foreach ($pid in @($pids.backend, $pids.ml, $pids.frontend)) {
        if ($pid) { Stop-Process -Id $pid -Force }
    }
    Remove-Item $pidFile -Force
    Write-Host 'Stopped tracked services.'
} else {
    Write-Host 'No PID file found. Nothing to stop.'
}
