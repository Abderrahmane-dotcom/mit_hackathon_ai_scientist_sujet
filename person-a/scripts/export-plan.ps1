# Generate a full plan from a hypothesis and save it as Markdown.
# Usage:
#   .\scripts\export-plan.ps1 -Sample diagnostics
#   .\scripts\export-plan.ps1 -Hypothesis "your hypothesis here"
#   .\scripts\export-plan.ps1 -Sample cell_bio -Out reports\my-plan.md

param(
  [string]$Hypothesis,
  [ValidateSet("diagnostics","gut_health","cell_bio","climate")]
  [string]$Sample = "diagnostics",
  [string]$BaseUrl = "http://localhost:8787",
  [string]$Out
)

$ErrorActionPreference = "Stop"

$samples = @{
  diagnostics = "A paper-based electrochemical biosensor functionalized with anti-CRP antibodies will detect C-reactive protein in whole blood at concentrations below 0.5 mg/L within 10 minutes, matching laboratory ELISA sensitivity without requiring sample preprocessing."
  gut_health  = "Supplementing C57BL/6 mice with Lactobacillus rhamnosus GG for 4 weeks will reduce intestinal permeability by at least 30% compared to controls, measured by FITC-dextran assay, due to upregulation of tight junction proteins claudin-1 and occludin."
  cell_bio    = "Replacing sucrose with trehalose as a cryoprotectant in the freezing medium will increase post-thaw viability of HeLa cells by at least 15 percentage points compared to the standard DMSO protocol, due to trehalose's superior membrane stabilization at low temperatures."
  climate     = "Introducing Sporomusa ovata into a bioelectrochemical system at a cathode potential of -400mV vs SHE will fix CO2 into acetate at a rate of at least 150 mmol/L/day, outperforming current biocatalytic carbon capture benchmarks by at least 20%."
}

if (-not $Hypothesis) {
  $Hypothesis = $samples[$Sample]
  Write-Host "Sample: $Sample" -ForegroundColor Cyan
}

Write-Host "Generating plan via $BaseUrl/api/plan.md ..." -ForegroundColor Yellow
Write-Host "(this typically takes 40-90s on real LLM)" -ForegroundColor DarkGray

$body = @{ hypothesis = $Hypothesis } | ConvertTo-Json
$sw = [Diagnostics.Stopwatch]::StartNew()
$resp = Invoke-WebRequest -Uri "$BaseUrl/api/plan.md" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 240
$sw.Stop()

if ($resp.StatusCode -ne 200) { throw "HTTP $($resp.StatusCode): $($resp.Content)" }

if (-not $Out) {
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $dir = Join-Path $PSScriptRoot "..\reports"
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  $Out = Join-Path $dir "plan-$Sample-$stamp.md"
}

$md = $resp.Content
[IO.File]::WriteAllText($Out, $md, [Text.UTF8Encoding]::new($false))

Write-Host ("`nWrote {0}" -f $Out) -ForegroundColor Green
Write-Host ("Size: {0:N1} KB | Elapsed: {1:N1}s" -f ($md.Length/1024), $sw.Elapsed.TotalSeconds) -ForegroundColor Green
