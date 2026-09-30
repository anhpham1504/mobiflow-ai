param([int]$EvaluatorPid = 0)
$ErrorActionPreference = 'Stop'
$evalOs = Get-CimInstance Win32_OperatingSystem
$evalCpu = @(Get-CimInstance Win32_Processor | Select-Object Name, NumberOfCores, NumberOfLogicalProcessors, LoadPercentage)
$evalProcesses = @(Get-CimInstance Win32_Process | Where-Object { $_.Name -in @('node.exe', 'ollama.exe', 'docker.exe') } | ForEach-Object {
    $evalCommand = [string]$_.CommandLine
    $evalMcp = $evalCommand -match 'mcp' -and $evalCommand -notmatch 'scripts[/\\]evaluation'
    [pscustomobject]@{
        pid = $_.ProcessId
        executable = $_.Name
        self = $_.ProcessId -eq $EvaluatorPid
        mcpServer = $evalMcp
        commandUnavailable = [string]::IsNullOrEmpty($evalCommand)
        evaluation = !$evalMcp -and ($evalCommand -match 'scripts[/\\]evaluation|m10-eval-diagnostics|ai:evaluate|eval:ai')
        appWorker = !$evalMcp -and ($evalCommand -match 'next[/\\]dist[/\\]bin[/\\]next.*(?:start|dev)|dist[/\\]main(?:\.js)?|scripts[/\\]dev[/\\]dev\.mjs')
        browserTest = !$evalMcp -and ($evalCommand -match 'playwright.*\btest\b|playwright\.m\d+\.config')
        integration = !$evalMcp -and ($evalCommand -match 'integration|m[2468]-runtime\.mjs')
        ingestion = !$evalMcp -and ($evalCommand -match 'ingest-knowledge|demo[/\\](ready|reset|warmup)\.mjs')
        build = !$evalMcp -and ($evalCommand -match 'typescript[/\\]bin[/\\]tsc|next.*\bbuild\b|docker.*\bbuild\b')
    }
})
$evalPower = (& powercfg /getactivescheme | Out-String).Trim()
$evalPowerExit = $LASTEXITCODE
try {
    $evalBattery = @(Get-CimInstance -Namespace root/WMI -ClassName BatteryStatus | Select-Object PowerOnline, Charging, Discharging, RemainingCapacity)
    $evalBatteryStatus = 'AVAILABLE'
} catch { $evalBattery = @(); $evalBatteryStatus = 'UNAVAILABLE' }
$evalGpuText = & nvidia-smi --query-gpu=name,driver_version,memory.total,memory.used,utilization.gpu,temperature.gpu,power.draw,power.limit,clocks.sm,clocks.mem,pstate --format=csv,noheader,nounits 2>$null
$evalGpuExit = $LASTEXITCODE
$evalGpu = if ($evalGpuExit -eq 0) { @($evalGpuText | ConvertFrom-Csv -Header name,driverVersion,totalMiB,usedMiB,utilizationPercent,temperatureC,powerW,powerLimitW,smMHz,memoryMHz,pstate) } else { @() }
$evalDockerText = & docker compose ps --all --format json 2>$null
$evalDockerExit = $LASTEXITCODE
$evalDocker = if ($evalDockerExit -eq 0) { @($evalDockerText | ForEach-Object { $_ | ConvertFrom-Json } | Select-Object Service, State, Health) } else { @() }
[pscustomobject]@{
    at = (Get-Date).ToUniversalTime().ToString('o')
    os = [pscustomobject]@{ name = $evalOs.Caption; version = $evalOs.Version; build = $evalOs.BuildNumber; architecture = $evalOs.OSArchitecture }
    cpu = $evalCpu
    memoryKiB = [pscustomobject]@{ total = $evalOs.TotalVisibleMemorySize; available = $evalOs.FreePhysicalMemory }
    power = [pscustomobject]@{ activePlan = $evalPower; exitCode = $evalPowerExit; overlayPowerMode = 'UNAVAILABLE: active scheme does not expose the Windows Settings overlay'; batteryStatus = $evalBatteryStatus; battery = $evalBattery }
    gpu = [pscustomobject]@{ status = $(if ($evalGpuExit -eq 0) { 'AVAILABLE' } else { 'UNAVAILABLE' }); devices = $evalGpu }
    docker = [pscustomobject]@{ status = $(if ($evalDockerExit -eq 0) { 'AVAILABLE' } else { 'UNAVAILABLE' }); services = $evalDocker }
    processes = $evalProcesses
    processLimitation = 'Command-pattern snapshot only; idle MCP servers are separate. No usernames, paths or raw command lines retained. Does not prove host-wide exclusivity or during-call GPU utilization.'
} | ConvertTo-Json -Depth 8
