# NOVAX Ops — Start Postiz + Cloudflare Tunnel
# Run from the agency-ops folder: .\docker\start.ps1

$ErrorActionPreference = "Continue"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Parse postiz.env
$envPath = Join-Path $ScriptDir "postiz.env"
$envVars = @{}
Get-Content $envPath | ForEach-Object {
    if ($_ -match '^([A-Z_][A-Z0-9_]*)=(.+)$') {
        $envVars[$Matches[1]] = $Matches[2]
    }
}

$token = $envVars['CLOUDFLARE_TUNNEL_TOKEN']
if (-not $token -or $token -eq 'PASTE_YOUR_TOKEN_HERE') {
    Write-Host ""
    Write-Host "  ACTION NEEDED:" -ForegroundColor Red
    Write-Host "  Open docker/postiz.env and replace PASTE_YOUR_TOKEN_HERE" -ForegroundColor Red
    Write-Host "  with the token from Cloudflare Zero Trust -> Tunnels -> novax-tunnel" -ForegroundColor Red
    Write-Host ""
    exit 1
}

Write-Host ""
Write-Host "Starting Postiz containers (postgres + redis + app)..." -ForegroundColor Cyan
docker compose -f "$ScriptDir\postiz.yml" --env-file "$ScriptDir\postiz.env" up -d

if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker compose failed. Is Docker Desktop running?" -ForegroundColor Red
    exit 1
}

Write-Host "Waiting 15 seconds for Postiz to finish booting..." -ForegroundColor Gray
Start-Sleep -Seconds 15

Write-Host "Starting Cloudflare Tunnel in a new window..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host 'Cloudflare Tunnel running — keep this window open' -ForegroundColor Green; cloudflared tunnel run --token $token"

Write-Host ""
Write-Host "All done." -ForegroundColor Green
Write-Host "  Postiz UI  ->  https://postiz.novaxops.com" -ForegroundColor Yellow
Write-Host "  Postiz API ->  https://postiz-api.novaxops.com" -ForegroundColor Yellow
Write-Host ""
Write-Host "Keep the Cloudflare tunnel window open while using Postiz." -ForegroundColor Gray
Write-Host "To stop everything: .\docker\stop.ps1" -ForegroundColor Gray
