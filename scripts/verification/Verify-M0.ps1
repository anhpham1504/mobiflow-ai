# Documentation verification only. No dependencies, application execution or file mutation.
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$failures = [System.Collections.Generic.List[string]]::new()
$counts = @{ Assertions = 0; Links = 0 }

function Assert-DocumentCheck([bool]$Condition, [string]$Name) {
    $counts.Assertions++
    if (-not $Condition) { $failures.Add($Name) }
}

function Read-RepoFile([string]$RelativePath) {
    $path = Join-Path $repoRoot $RelativePath
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { return '' }
    return [System.IO.File]::ReadAllText($path)
}

function Get-SectionText([string]$Text, [string]$Heading) {
    $pattern = '(?ms)^## ' + [regex]::Escape($Heading) + '\r?\n(.*?)(?=^## |\z)'
    return [regex]::Match($Text, $pattern).Groups[1].Value
}

$required = @(
    'AGENTS.md'
    'docs/specs/PROJECT_SPEC.md'
    'docs/specs/BUSINESS_WORKFLOW.md'
    'docs/specs/AUTHORIZATION_SPEC.md'
    'docs/specs/REQUEST_STATE_MACHINE.md'
    'docs/specs/AI_BEHAVIOR_SPEC.md'
    'docs/specs/AI_SAFETY_SPEC.md'
    'docs/specs/TOOL_CALLING_SPEC.md'
    'docs/specs/RAG_SPEC.md'
    'docs/specs/SLA_SPEC.md'
    'docs/specs/DATABASE_SPEC.md'
    'docs/specs/API_SPEC.md'
    'docs/specs/UI_SPEC.md'
    'docs/specs/TEST_STRATEGY.md'
    'docs/specs/DEMO_DATA_SPEC.md'
    'docs/architecture/ARCHITECTURE.md'
    'docs/architecture/AI_ARCHITECTURE.md'
    'docs/IMPLEMENTATION_PLAN.md'
    'docs/architecture/adr/0001-monorepo.md'
    'docs/architecture/adr/0002-postgres-pgvector.md'
    'docs/architecture/adr/0003-local-ollama.md'
    'docs/architecture/adr/0004-controlled-ai-orchestration.md'
    'docs/architecture/adr/0005-human-in-the-loop.md'
    'docs/verification/REPOSITORY_BASELINE.md'
    'docs/verification/MILESTONE_0_VERIFICATION.md'
)

foreach ($file in $required) {
    $content = Read-RepoFile $file
    Assert-DocumentCheck ($content.Length -gt 100) "Required document missing/empty: $file"
    Assert-DocumentCheck ($content -match '(?m)^# .+') "Missing document title: $file"
}

$auth = Get-SectionText (Read-RepoFile 'docs/specs/AUTHORIZATION_SPEC.md') 'Business roles'
$roles = @([regex]::Matches($auth, '(?m)^\| (USER|STAFF|MANAGER|[A-Z_]+) \|') | ForEach-Object { $_.Groups[1].Value })
Assert-DocumentCheck (($roles -join ',') -eq 'USER,STAFF,MANAGER') 'Business role table must contain exactly USER, STAFF, MANAGER'

$stateText = Read-RepoFile 'docs/specs/REQUEST_STATE_MACHINE.md'
$stateSection = Get-SectionText $stateText 'Canonical states'
$states = @([regex]::Matches($stateSection, '(?m)^\| ([A-Z_]+) \|') | ForEach-Object { $_.Groups[1].Value })
$expectedStates = @('NEW','AI_ANALYZING','TRIAGED','PENDING_APPROVAL','ASSIGNED','IN_PROGRESS','WAITING_USER','RESOLVED','CLOSED','CANCELED')
Assert-DocumentCheck (($states -join ',') -eq ($expectedStates -join ',')) 'Canonical ten-state table differs from frozen vocabulary'
$matrix = Get-SectionText $stateText 'Transition matrix'
$transitions = @([regex]::Matches($matrix, '(?m)^\| ([A-Z_]+) \| ([A-Z_]+) \| ([A-Z_]+) \| ([^|]+) \|') | ForEach-Object {
    [pscustomobject]@{ From=$_.Groups[1].Value; Action=$_.Groups[2].Value; To=$_.Groups[3].Value; Actor=$_.Groups[4].Value.Trim() }
})
$expectedEdges = @(
    'NEW|START_AI_ANALYSIS|AI_ANALYZING'
    'AI_ANALYZING|COMPLETE_AI_ANALYSIS|TRIAGED'
    'AI_ANALYZING|FAIL_AI_ANALYSIS|NEW'
    'NEW|MANUAL_TRIAGE|TRIAGED'
    'TRIAGED|SUBMIT_FOR_APPROVAL|PENDING_APPROVAL'
    'PENDING_APPROVAL|APPROVE_AND_ASSIGN|ASSIGNED'
    'PENDING_APPROVAL|REJECT_APPROVAL|TRIAGED'
    'ASSIGNED|START_WORK|IN_PROGRESS'
    'IN_PROGRESS|REQUEST_USER_INFO|WAITING_USER'
    'WAITING_USER|USER_PROVIDE_INFO|IN_PROGRESS'
    'IN_PROGRESS|RESOLVE|RESOLVED'
    'RESOLVED|USER_CONFIRM|CLOSED'
    'RESOLVED|USER_REOPEN|IN_PROGRESS'
    'NEW|CANCEL|CANCELED'
    'AI_ANALYZING|CANCEL|CANCELED'
    'TRIAGED|CANCEL|CANCELED'
    'PENDING_APPROVAL|CANCEL|CANCELED'
    'ASSIGNED|CANCEL|CANCELED'
    'IN_PROGRESS|CANCEL|CANCELED'
    'WAITING_USER|CANCEL|CANCELED'
)
$actualEdges = @($transitions | ForEach-Object { "$($_.From)|$($_.Action)|$($_.To)" })
Assert-DocumentCheck (($actualEdges -join ',') -eq ($expectedEdges -join ',')) 'Transition matrix differs from documented M0 edge set'
foreach ($transition in $transitions) {
    Assert-DocumentCheck (($states -contains $transition.From) -and ($states -contains $transition.To)) 'Transition uses unknown state'
    Assert-DocumentCheck ($transition.From -notin @('CLOSED','CANCELED')) 'Terminal state has an outgoing transition'
    if ($transition.Action -eq 'APPROVE_AND_ASSIGN') { Assert-DocumentCheck ($transition.Actor -eq 'MANAGER') 'Assignment is not manager-only' }
    if ($transition.Action -in @('USER_CONFIRM','USER_REOPEN')) { Assert-DocumentCheck ($transition.Actor -eq 'owning USER') 'Confirmation/reopen is not owner-only' }
}

$toolSection = Get-SectionText (Read-RepoFile 'docs/specs/TOOL_CALLING_SPEC.md') 'Tool inventory'
$toolNames = @([regex]::Matches($toolSection, '(?m)^\| ([a-z][A-Za-z]+) \|') | ForEach-Object { $_.Groups[1].Value })
$expectedTools = @('searchKnowledge','findSimilarRequests','getSlaPolicy','getCandidateStaff','getStaffWorkload','getRequestHistory')
Assert-DocumentCheck (($toolNames -join ',') -eq ($expectedTools -join ',')) 'Mandatory six-tool registry differs from plan'

$verification = Read-RepoFile 'docs/verification/MILESTONE_0_VERIFICATION.md'
$templateHeadings = @('Scope implemented','Files/modules changed','Database changes','API changes','UI changes','AI changes','Security considerations','Tests executed','Manual verification','Known limitations','Deferred items','Release blockers','Gate')
foreach ($heading in $templateHeadings) {
    Assert-DocumentCheck ($verification -match ('(?m)^## ' + [regex]::Escape($heading) + '\r?$')) "Verification template missing: $heading"
}
$plan = Read-RepoFile 'docs/IMPLEMENTATION_PLAN.md'
foreach ($milestone in 1..10) {
    Assert-DocumentCheck ($plan -match ('(?m)^\| M' + $milestone + ' \|')) "Missing milestone dependency row M$milestone"
}

# Check only the worked SLA examples in the specification; this is not a runtime SLA test.
$budgetSeconds = 120 * 60
$started = [DateTimeOffset]::Parse('2026-09-28T09:00:00Z').ToUnixTimeSeconds()
$resolved = [DateTimeOffset]::Parse('2026-09-28T11:00:00Z').ToUnixTimeSeconds()
$pausedSeconds = 30 * 60
$heldSeconds = 60 * 60
$reopened = [DateTimeOffset]::Parse('2026-09-28T12:00:00Z').ToUnixTimeSeconds()
$initialDue = $started + $budgetSeconds + $pausedSeconds
$reopenDue = $initialDue + $heldSeconds
Assert-DocumentCheck (($resolved - $started - $pausedSeconds) -eq 5400 -and [DateTimeOffset]::FromUnixTimeSeconds($initialDue).ToString('HH:mm') -eq '11:30') 'SLA worked example: initial due/elapsed'
Assert-DocumentCheck (($budgetSeconds - ($reopened - $started - $pausedSeconds - $heldSeconds)) -eq 1800 -and [DateTimeOffset]::FromUnixTimeSeconds($reopenDue).ToString('HH:mm') -eq '12:30') 'SLA worked example: reopen remaining/due'
Assert-DocumentCheck (($reopenDue - $started - $pausedSeconds - $heldSeconds) -eq $budgetSeconds) 'SLA worked example: deadline equality'
Assert-DocumentCheck (($reopenDue + 1 - $started - $pausedSeconds - $heldSeconds) -gt $budgetSeconds) 'SLA worked example: one-second breach'
Assert-DocumentCheck (($budgetSeconds * 0.20) -eq (24 * 60)) 'SLA worked example: 20 percent risk boundary'
Assert-DocumentCheck ((75 * 60) -gt (60 * 60)) 'SLA worked example: priority reduction overrun'

$hashes = @{
    'docs/reference/MOBIFLOW_AI_ASTRA6_M0_M10_MASTER_PLAN.md' = '3B1711E3A42E8FA966A73080FCEAA41F3A23CF0E9C3719E9C6ABF3D1488ACE2A'
    'docs/reference/M0_EXECUTION_PROMPT.txt' = 'FA3E84CCC779542BD9E64A485A62DC2544FEF3EC8FBFC553FB2A10FB5102B392'
}
foreach ($entry in $hashes.GetEnumerator()) {
    $path = Join-Path $repoRoot $entry.Key
    $hash = if (Test-Path -LiteralPath $path) { (Get-FileHash -Algorithm SHA256 -LiteralPath $path).Hash } else { '' }
    Assert-DocumentCheck ($hash -eq $entry.Value) "Canonical archive hash mismatch: $($entry.Key)"
}

$authored = @('README.md','AGENTS.md') + @(Get-ChildItem -LiteralPath (Join-Path $repoRoot 'docs') -Recurse -File -Filter '*.md' | Where-Object { $_.FullName -notlike '*\docs\reference\*' } | ForEach-Object { [System.IO.Path]::GetRelativePath($repoRoot,$_.FullName) })
foreach ($relative in $authored) {
    $fullPath = Join-Path $repoRoot $relative
    $content = Read-RepoFile $relative
    $fences = [regex]::Matches($content, '(?m)^```').Count
    Assert-DocumentCheck (($fences % 2) -eq 0) "Unbalanced code fences: $relative"
    Assert-DocumentCheck ($content -notmatch '(?m)[\t ]+$') "Trailing whitespace: $relative"
    Assert-DocumentCheck ($content -notmatch '(?i)\b(TODO|TBD|FIXME)\b') "Unresolved placeholder: $relative"
    $expectedColumns = 0
    $lineNumber = 0
    foreach ($line in ($content -split '\r?\n')) {
        $lineNumber++
        if ($line -match '^\|') {
            $columns = [regex]::Matches($line, '(?<!\\)\|').Count
            if ($expectedColumns -eq 0) { $expectedColumns = $columns }
            Assert-DocumentCheck ($columns -eq $expectedColumns) "Malformed Markdown table: ${relative}:$lineNumber"
        } else { $expectedColumns = 0 }
    }
    foreach ($match in [regex]::Matches($content, '\[[^\]\r\n]+\]\(([^)\r\n]+)\)')) {
        $target = $match.Groups[1].Value.Trim('<','>')
        if ($target -match '^(https?://|mailto:|#)') { continue }
        $target = ($target -split '#',2)[0]
        $resolved = [System.IO.Path]::GetFullPath((Join-Path (Split-Path $fullPath -Parent) $target))
        $counts.Links++
        Assert-DocumentCheck (Test-Path -LiteralPath $resolved) "Broken local link: $relative -> $target"
    }
}

foreach ($path in @('package.json','package-lock.json','docker-compose.yml','compose.yml','apps','packages','node_modules','.env','.env.example')) {
    Assert-DocumentCheck (-not (Test-Path -LiteralPath (Join-Path $repoRoot $path))) "M0-only scope violated by application/infrastructure scaffold: $path"
}

Write-Output "Required M0 documents: $($required.Count)"
Write-Output "Authored Markdown files checked: $($authored.Count)"
Write-Output "Roles: $($roles.Count); states: $($states.Count); transition rows: $($transitions.Count); tools: $($toolNames.Count)"
Write-Output "Local file links checked: $($counts.Links)"
Write-Output "Documentation assertions: $($counts.Assertions)"
if ($failures.Count -gt 0) {
    foreach ($failure in $failures) { Write-Output "FAIL: $failure" }
    Write-Output "Documentation checks: FAIL ($($failures.Count) failures)"
    exit 1
}
Write-Output 'Documentation checks: PASS'
Write-Output 'Scope: document structure only; manual consistency review and milestone gate remain separate.'
exit 0
