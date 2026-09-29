$ErrorActionPreference = 'Stop'
$cpu = Get-CimInstance Win32_Processor | Select-Object Name,NumberOfCores,NumberOfLogicalProcessors,LoadPercentage
$memory = Get-CimInstance Win32_OperatingSystem | Select-Object TotalVisibleMemorySize,FreePhysicalMemory
$nodes = @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" | ForEach-Object {
  [pscustomobject]@{pid=$_.ProcessId; parentPid=$_.ParentProcessId; repositoryNamed=($_.CommandLine -like '*MobiFlow*'); evaluation=($_.CommandLine -match 'm[0-9].*evaluat|m10-eval-diagnos'); appWorker=($_.CommandLine -match 'next|apps.api|dist.main'); commandLineOmitted=$true}
})
$containers = @(docker compose ps --all --format json | ForEach-Object {
  $row = $_ | ConvertFrom-Json
  [pscustomobject]@{service=$row.Service; state=$row.State; health=$row.Health; status=$row.Status}
})
$gpu = & nvidia-smi --query-gpu=name,driver_version,memory.total,memory.used,utilization.gpu,temperature.gpu,power.draw,power.limit,clocks.sm,clocks.mem,pstate --format=csv,noheader,nounits
[pscustomobject]@{at=(Get-Date).ToUniversalTime().ToString('o'); powerPlan=(& powercfg /getactivescheme | Out-String).Trim(); cpu=$cpu; memoryKiB=$memory; nodes=$nodes; containers=$containers; gpuColumns='name,driver_version,totalMiB,usedMiB,utilizationPercent,temperatureC,powerW,powerLimitW,smMHz,memoryMHz,pstate'; gpu=$gpu; gpuExit=$LASTEXITCODE; processLimitation='Classification uses command text patterns, not process working directories. Unrelated application processes are not stopped.'} | ConvertTo-Json -Depth 8
