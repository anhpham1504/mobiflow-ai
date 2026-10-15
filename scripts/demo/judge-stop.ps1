[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location -LiteralPath $repositoryRoot

docker compose down --remove-orphans
if ($LASTEXITCODE -ne 0) {
  throw "docker compose down failed with exit code $LASTEXITCODE."
}

Write-Host 'MobiFlow AI containers stopped. Demo volumes were preserved.'
