# NOVAX Ops — Stop Postiz + Cloudflare Tunnel
# Run from the agency-ops folder: .\docker\stop.ps1

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "Stopping Postiz containers..." -ForegroundColor Cyan
docker compose -f "$ScriptDir\postiz.yml" down

Write-Host "Stopping Cloudflare tunnel process..." -ForegroundColor Cyan
Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force

Write-Host "All stopped." -ForegroundColor Green
