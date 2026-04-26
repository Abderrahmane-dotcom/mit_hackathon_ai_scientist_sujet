# Real-world Person B smoke test:
#  - Calls /api/qc on all 4 brief samples (novelty)
#  - Generates one full plan and validates its actual LLM-produced catalog URLs
# Uses ~7 Tavily credits.

$ErrorActionPreference = "Stop"
$base = "http://localhost:8787"

# Load samples from src/samples.ts via a tiny tsx eval
$samplesJson = npx tsx -e "import { SAMPLES } from './src/samples.ts'; console.log(JSON.stringify(SAMPLES));"
$samples = $samplesJson | ConvertFrom-Json

Write-Host "`n=== /api/qc on $($samples.Count) brief samples ===" -ForegroundColor Cyan
foreach ($s in $samples) {
  $body = @{ hypothesis = $s.hypothesis } | ConvertTo-Json
  $sw = [Diagnostics.Stopwatch]::StartNew()
  $r = Invoke-RestMethod -Uri "$base/api/qc" -Method Post -Body $body -ContentType "application/json"
  $sw.Stop()
  $refCount = if ($r.refs) { $r.refs.Count } else { 0 }
  $sloOk = if ($r.latency_ms -lt 8000) { "OK" } else { "SLOW" }
  Write-Host ("  [{0,-12}] signal={1,-22}  refs={2}  {3}ms  ({4})" -f $s.id, $r.signal, $refCount, $r.latency_ms, $sloOk)
}

Write-Host "`n=== /api/classify on each sample ===" -ForegroundColor Cyan
foreach ($s in $samples) {
  $body = @{ hypothesis = $s.hypothesis } | ConvertTo-Json
  $r = Invoke-RestMethod -Uri "$base/api/classify" -Method Post -Body $body -ContentType "application/json"
  Write-Host ("  [{0,-12}] domain={1,-20} type={2}" -f $s.id, $r.domain, $r.experiment_type)
}

Write-Host "`n=== Full plan generation (cell_bio) → validate real catalog URLs ===" -ForegroundColor Cyan
$cellBio = $samples | Where-Object { $_.id -eq "cell_bio" }
$planBody = @{ hypothesis = $cellBio.hypothesis } | ConvertTo-Json
$tmp = New-TemporaryFile

# Stream /api/plan, capture only the final 'done' SSE event
$req = [System.Net.HttpWebRequest]::Create("$base/api/plan")
$req.Method = "POST"
$req.ContentType = "application/json"
$req.Accept = "text/event-stream"
$req.Timeout = 180000
$bytes = [Text.Encoding]::UTF8.GetBytes($planBody)
$req.ContentLength = $bytes.Length
$req.GetRequestStream().Write($bytes, 0, $bytes.Length)
$resp = $req.GetResponse()
$reader = New-Object IO.StreamReader($resp.GetResponseStream())

$plan = $null
$evt = $null
while (-not $reader.EndOfStream) {
  $line = $reader.ReadLine()
  if ($line -match "^event: (.+)$") { $evt = $Matches[1].Trim(); continue }
  if ($line -match "^data: (.+)$") {
    $payload = $Matches[1]
    if ($evt -eq "done") {
      $plan = $payload | ConvertFrom-Json
      break
    } elseif ($evt -eq "error") {
      Write-Host "  ERROR: $payload" -ForegroundColor Red
      $reader.Close(); $resp.Close(); exit 1
    }
  }
}
$reader.Close(); $resp.Close()

if (-not $plan) { Write-Host "  no plan returned" -ForegroundColor Red; exit 1 }

Write-Host ("  plan ready: {0} materials, {1} protocol steps, {2} budget lines" -f `
  $plan.materials.items.Count, $plan.protocol.steps.Count, $plan.budget.lines.Count)

Write-Host "`n  Materials produced by the LLM:" -ForegroundColor DarkGray
foreach ($m in $plan.materials.items) {
  Write-Host ("    - {0,-30} #{1,-15} {2}" -f $m.name, $m.catalog_number, $m.catalog_url)
}

# Now validate those real URLs
$valBody = @{ items = $plan.materials.items } | ConvertTo-Json -Depth 10
Write-Host "`n=== /api/validate-catalog on the LLM's actual catalog URLs ===" -ForegroundColor Cyan
$report = Invoke-RestMethod -Uri "$base/api/validate-catalog" -Method Post -Body $valBody -ContentType "application/json"
Write-Host ("  passed: {0}/{1}" -f $report.passed, $report.total) -ForegroundColor $(if ($report.passed -eq $report.total) { "Green" } else { "Yellow" })
foreach ($c in $report.checks) {
  $color = if ($c.ok) { "Green" } else { "Red" }
  $tag = if ($c.ok) { "OK " } else { "BAD" }
  Write-Host ("    [{0}] {1,-30} status={2,-4} {3}" -f $tag, $c.name, $c.status, $(if ($c.reason) { $c.reason } else { "" })) -ForegroundColor $color
}
