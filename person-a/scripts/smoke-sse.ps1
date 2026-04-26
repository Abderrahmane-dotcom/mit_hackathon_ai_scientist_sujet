# Live SSE smoke test for /api/plan
# Streams events to console; truncates token deltas for readability.

param(
  [string]$Url = "http://localhost:8787/api/plan",
  [string]$Hypothesis = "A paper microfluidic biosensor with gold nanoparticles can detect CRP in human serum at clinical thresholds within 15 minutes."
)

$body = @{ hypothesis = $Hypothesis } | ConvertTo-Json -Compress
$req = [System.Net.HttpWebRequest]::Create($Url)
$req.Method = "POST"
$req.ContentType = "application/json"
$req.Accept = "text/event-stream"
$req.ReadWriteTimeout = 600000
$req.Timeout = 600000

$bytes = [Text.Encoding]::UTF8.GetBytes($body)
$req.ContentLength = $bytes.Length
$rs = $req.GetRequestStream(); $rs.Write($bytes, 0, $bytes.Length); $rs.Close()

$resp = $req.GetResponse()
$reader = New-Object IO.StreamReader($resp.GetResponseStream())

$evt = $null
$tokenCounts = @{}
$t0 = Get-Date

while (-not $reader.EndOfStream) {
  $line = $reader.ReadLine()
  if ($line.StartsWith("event:")) { $evt = $line.Substring(6).Trim() }
  elseif ($line.StartsWith("data:")) {
    $data = $line.Substring(5).Trim()
    switch ($evt) {
      "agent_start" { $obj = $data | ConvertFrom-Json; Write-Host "[start ] $($obj.section)" -ForegroundColor Cyan }
      "token"       { $obj = $data | ConvertFrom-Json; $tokenCounts[$obj.section] = ($tokenCounts[$obj.section] + 1) }
      "section"     { $obj = $data | ConvertFrom-Json; $tk = $tokenCounts[$obj.section]; Write-Host "[done  ] $($obj.section) ($($obj.latency_ms)ms, $tk tokens)" -ForegroundColor Green }
      "info"        { $obj = $data | ConvertFrom-Json; Write-Host "[info  ] $($obj.message)" -ForegroundColor DarkGray }
      "warning"     { $obj = $data | ConvertFrom-Json; Write-Host "[warn  ] $($obj.message)" -ForegroundColor Yellow }
      "error"       { $obj = $data | ConvertFrom-Json; Write-Host "[ERROR ] $($obj.message)" -ForegroundColor Red; break }
      "done"        {
        $plan = $data | ConvertFrom-Json
        $dt = ((Get-Date) - $t0).TotalSeconds
        Write-Host "`n[plan ready in $([math]::Round($dt,1))s]" -ForegroundColor Magenta
        Write-Host "  steps:    $($plan.protocol.steps.Count)"
        Write-Host "  reagents: $($plan.materials.items.Count)"
        Write-Host "  budget:   `$$($plan.budget.total_usd)"
        Write-Host "  weeks:    $($plan.timeline.weeks)"
        Write-Host "  tokens per section: $($tokenCounts | Out-String)"
      }
    }
  }
}
$reader.Close(); $resp.Close()
