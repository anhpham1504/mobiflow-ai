[CmdletBinding()]
param(
  [string]$Model
)

$ErrorActionPreference = 'Stop'
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location -LiteralPath $repositoryRoot

function Invoke-Checked {
  param(
    [Parameter(Mandatory)] [string]$File,
    [Parameter(Mandatory)] [string[]]$Arguments
  )

  & $File @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$File failed with exit code $LASTEXITCODE."
  }
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw 'Node.js 24 is required.'
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw 'npm is required.'
}
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw 'Docker Desktop is required.'
}

if (-not (Test-Path -LiteralPath 'node_modules')) {
  Invoke-Checked npm @('ci', '--no-audit', '--no-fund')
}

if (-not (Test-Path -LiteralPath '.env')) {
  $environmentArguments = @('run', 'env:setup')
  if ($Model) {
    $environmentArguments += @('--', $Model)
  }
  Invoke-Checked npm $environmentArguments
}

Invoke-Checked docker @('compose', 'config', '--quiet')
Invoke-Checked docker @('compose', 'up', '-d', '--wait', 'postgres')
Invoke-Checked npm @('run', 'db:migrate')
Invoke-Checked npm @('run', 'demo:seed')
Invoke-Checked docker @('compose', 'up', '-d', '--build', '--wait', 'api', 'web')
Invoke-Checked docker @('compose', 'ps')

Write-Host ''
Write-Host 'MobiFlow AI is ready for review:'
Write-Host '  Web:     http://localhost:3000'
Write-Host '  Login:   http://localhost:3000/login'
Write-Host '  Swagger: http://localhost:3001/api/docs'
Write-Host ''
Write-Host 'Demo accounts use password: MobiFlowDemo!2026'
Write-Host '  USER:    user@mobiflow.local'
Write-Host '  MANAGER: manager@mobiflow.local'
Write-Host '  STAFF:   staff.iot@mobiflow.local'
