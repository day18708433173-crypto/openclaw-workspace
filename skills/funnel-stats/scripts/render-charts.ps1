# Funnel stats chart (System.Drawing, Chinese via JSON strings)
# Usage:
#   powershell -File render-charts.ps1 -Title "..." -Out "out.png" -JsonFile data.json

param(
  [Parameter(Mandatory = $true)][string]$Title,
  [Parameter(Mandatory = $true)][string]$Out,
  [Parameter(Mandatory = $false)][string]$Json,
  [Parameter(Mandatory = $false)][string]$JsonFile
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

if ($JsonFile) {
  $Json = Get-Content -LiteralPath $JsonFile -Raw -Encoding UTF8
} elseif (-not $Json) {
  $Json = [Console]::In.ReadToEnd()
}
$data = $Json | ConvertFrom-Json
if ($data.title) { $Title = [string]$data.title }

$stages = @($data.stages)
if ($stages.Count -eq 0) {
  $stages = @(
    [pscustomobject]@{ name = "Screen"; count = 0 },
    [pscustomobject]@{ name = "R1"; count = 0 },
    [pscustomobject]@{ name = "R2"; count = 0 },
    [pscustomobject]@{ name = "Offer"; count = 0 }
  )
}
$rates = @($data.rates)
if ($rates.Count -eq 0) {
  $rates = @(
    [pscustomobject]@{ name = "R1"; rate = $null },
    [pscustomobject]@{ name = "R2"; rate = $null },
    [pscustomobject]@{ name = "Offer"; rate = $null },
    [pscustomobject]@{ name = "Total"; rate = $null }
  )
}

$width = 1000
$height = 720
$bmp = New-Object System.Drawing.Bitmap $width, $height
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
$g.Clear([System.Drawing.Color]::FromArgb(248, 250, 252))

function New-ChartFont {
  param([string]$Name, [float]$Size, [System.Drawing.FontStyle]$Style = [System.Drawing.FontStyle]::Regular)
  $candidates = @($Name, "Microsoft YaHei UI", "Microsoft YaHei", "SimSun", "Segoe UI")
  foreach ($fn in $candidates) {
    try { return New-Object -TypeName System.Drawing.Font -ArgumentList @($fn, $Size, $Style) } catch {}
  }
  return New-Object -TypeName System.Drawing.Font -ArgumentList @("Arial", $Size, $Style)
}

$fontTitle = New-ChartFont -Name "Microsoft YaHei UI" -Size 18 -Style Bold
$fontSub = New-ChartFont -Name "Microsoft YaHei UI" -Size 11
$fontPanel = New-ChartFont -Name "Microsoft YaHei UI" -Size 12 -Style Bold
$fontAxis = New-ChartFont -Name "Microsoft YaHei UI" -Size 9
$fontLabel = New-ChartFont -Name "Microsoft YaHei UI" -Size 10
$fontValue = New-ChartFont -Name "Microsoft YaHei UI" -Size 10 -Style Bold

$brushTitle = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(15, 23, 42))
$brushSub = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(100, 116, 139))
$brushLabel = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(51, 65, 85))
$penGrid = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(226, 232, 240)), 1
$penAxis = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(148, 163, 184)), 2
$brushCard = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)

$funnelColors = @(
  [System.Drawing.Color]::FromArgb(37, 99, 235),
  [System.Drawing.Color]::FromArgb(59, 130, 246),
  [System.Drawing.Color]::FromArgb(14, 165, 233),
  [System.Drawing.Color]::FromArgb(16, 185, 129)
)
$brushGreen = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(16, 185, 129))

$g.DrawString($Title, $fontTitle, $brushTitle, 40, 24)
$subtitle = [string]$data.subtitle
if (-not $subtitle) { $subtitle = "Stages & Pass Rate" }
$g.DrawString($subtitle, $fontSub, $brushSub, 40, 58)

function Fill-RoundRect {
  param($x, $y, $w, $h, $r, $brush)
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddArc($x, $y, $r, $r, 180, 90)
  $path.AddArc($x + $w - $r, $y, $r, $r, 270, 90)
  $path.AddArc($x + $w - $r, $y + $h - $r, $r, $r, 0, 90)
  $path.AddArc($x, $y + $h - $r, $r, $r, 90, 90)
  $path.CloseFigure()
  $g.FillPath($brush, $path)
}

# Left panel: funnel bars
$lx = 32; $ly = 100; $lw = 452; $lh = 560
Fill-RoundRect $lx $ly $lw $lh 12 $brushCard
$leftTitle = if ($data.leftTitle) { [string]$data.leftTitle } else { "Funnel" }
$g.DrawString($leftTitle, $fontPanel, $brushTitle, ($lx + 20), ($ly + 16))

$maxCount = ($stages | ForEach-Object { [double]$_.count } | Measure-Object -Maximum).Maximum
$hasStageData = $maxCount -gt 0
if ($maxCount -le 0) { $maxCount = 1 }
$n = $stages.Count
$rowH = 72
$gapY = 18
$totalH = $n * $rowH + ($n - 1) * $gapY
$startY = $ly + 70 + ([Math]::Max(0, (480 - $totalH) / 2))
$plotLeft = $lx + 120
$plotRight = $lx + $lw - 36
$plotW = $plotRight - $plotLeft

if ($hasStageData) {
for ($i = 0; $i -lt $n; $i++) {
  $count = [double]$stages[$i].count
  $name = [string]$stages[$i].name
  $ratio = if ($maxCount -gt 0) { $count / $maxCount } else { 0 }
  $barW = if ($count -gt 0) { [Math]::Max(28, [Math]::Round($plotW * (0.35 + 0.65 * $ratio))) } else { 2 }
  $bx = $plotLeft + ($plotW - $barW) / 2
  $by = $startY + $i * ($rowH + $gapY)
  $color = $funnelColors[[Math]::Min($i, $funnelColors.Count - 1)]
  $brushBar = New-Object System.Drawing.SolidBrush $color

  $vText = "{0}" -f [Math]::Round($count)
  $vSize = $g.MeasureString($vText, $fontValue)
  if ($count -gt 0) {
    Fill-RoundRect $bx $by $barW $rowH 10 $brushBar
    $brushWhite = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
    $g.DrawString($vText, $fontValue, $brushWhite, ($bx + ($barW - $vSize.Width) / 2), ($by + ($rowH - $vSize.Height) / 2))
    $brushWhite.Dispose()
  } else {
    $g.DrawString($vText, $fontValue, $brushLabel, ($plotLeft + ($plotW - $vSize.Width) / 2), ($by + ($rowH - $vSize.Height) / 2))
  }

  $lSize = $g.MeasureString($name, $fontLabel)
  $g.DrawString($name, $fontLabel, $brushLabel, ($plotLeft - 12 - $lSize.Width), ($by + ($rowH - $lSize.Height) / 2))
  $brushBar.Dispose()
}
} else {
  $emptyText = if ($data.emptyText) { [string]$data.emptyText } else { "No data" }
  $emptySize = $g.MeasureString($emptyText, $fontSub)
  $g.DrawString($emptyText, $fontSub, $brushSub, ($lx + ($lw - $emptySize.Width) / 2), ($ly + ($lh - $emptySize.Height) / 2))
}

# Right panel: conversion rates
$rx = 516; $ry = 100; $rw = 452; $rh = 560
Fill-RoundRect $rx $ry $rw $rh 12 $brushCard
$rightTitle = if ($data.rightTitle) { [string]$data.rightTitle } else { "Pass Rate" }
$g.DrawString($rightTitle, $fontPanel, $brushTitle, ($rx + 20), ($ry + 16))

$plotX = $rx + 56
$plotY = $ry + 56
$plotW2 = $rw - 80
$plotH = $rh - 120
$maxRate = 100.0

for ($i = 0; $i -le 4; $i++) {
  $gy = $plotY + $plotH - ($plotH * $i / 4.0)
  $g.DrawLine($penGrid, $plotX, $gy, ($plotX + $plotW2), $gy)
  $lab = "{0}%" -f [Math]::Round($maxRate * $i / 4.0)
  $g.DrawString($lab, $fontAxis, $brushSub, ($rx + 10), ($gy - 8))
}
$g.DrawLine($penAxis, $plotX, ($plotY + $plotH), ($plotX + $plotW2), ($plotY + $plotH))

$rn = [Math]::Max(1, $rates.Count)
$gap = 18
$barW2 = [Math]::Max(20, [Math]::Min(56, ($plotW2 - $gap * ($rn + 1)) / $rn))
$totalBarsW = $rn * $barW2 + ($rn - 1) * $gap
$startX = $plotX + ($plotW2 - $totalBarsW) / 2

$hasAnyRate = $false
foreach ($rateItem in $rates) {
  if (($null -ne $rateItem.rate) -and ("$($rateItem.rate)" -ne "")) { $hasAnyRate = $true; break }
}

if ($hasAnyRate) {
for ($i = 0; $i -lt $rates.Count; $i++) {
  $rateObj = $rates[$i].rate
  $hasRate = ($null -ne $rateObj) -and ("$rateObj" -ne "")
  $val = if ($hasRate) { [double]$rateObj } else { 0.0 }
  $bh = if ($hasRate) { [Math]::Max(2, [Math]::Round(($val / $maxRate) * $plotH)) } else { 2 }
  $bx = $startX + $i * ($barW2 + $gap)
  $by = $plotY + $plotH - $bh

  $br = [Math]::Min(8, [Math]::Floor($barW2 / 2))
  if ($bh -lt $br) {
    $g.FillRectangle($brushGreen, $bx, $by, $barW2, $bh)
  } else {
    $barPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $barPath.AddArc($bx, $by, $br, $br, 180, 90)
    $barPath.AddArc(($bx + $barW2 - $br), $by, $br, $br, 270, 90)
    $barPath.AddLine(($bx + $barW2), ($by + $br), ($bx + $barW2), ($by + $bh))
    $barPath.AddLine(($bx + $barW2), ($by + $bh), $bx, ($by + $bh))
    $barPath.AddLine($bx, ($by + $bh), $bx, ($by + $br))
    $barPath.CloseFigure()
    $g.FillPath($brushGreen, $barPath)
  }

  $vText = if ($hasRate) { "{0:N1}%" -f $val } else { "-" }
  $vSize = $g.MeasureString($vText, $fontValue)
  $g.DrawString($vText, $fontValue, $brushLabel, ($bx + ($barW2 - $vSize.Width) / 2), ($by - 18))

  $lText = [string]$rates[$i].name
  $short = $lText
  if ($lText -match "一面") { $short = "一面" }
  elseif ($lText -match "二面") { $short = "二面" }
  elseif ($lText -match "OFFER|Offer|offer") { $short = "OFFER" }
  elseif ($lText -match "总") { $short = "总通过" }
  elseif ($lText.Length -gt 4) { $short = $lText.Substring(0, 4) }
  $lSize = $g.MeasureString($short, $fontLabel)
  $g.DrawString($short, $fontLabel, $brushLabel, ($bx + ($barW2 - $lSize.Width) / 2), ($plotY + $plotH + 10))
}
} else {
  $emptyRateText = if ($data.emptyRateText) { [string]$data.emptyRateText } else { "No rates" }
  $emptyRateSize = $g.MeasureString($emptyRateText, $fontSub)
  $g.DrawString($emptyRateText, $fontSub, $brushSub, ($rx + ($rw - $emptyRateSize.Width) / 2), ($ry + ($rh - $emptyRateSize.Height) / 2))
}

$outPath = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Out)
$dir = Split-Path -Parent $outPath
if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
$bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)

$g.Dispose(); $bmp.Dispose()
$fontTitle.Dispose(); $fontSub.Dispose(); $fontPanel.Dispose(); $fontAxis.Dispose(); $fontLabel.Dispose(); $fontValue.Dispose()
$brushTitle.Dispose(); $brushSub.Dispose(); $brushLabel.Dispose(); $brushCard.Dispose(); $brushGreen.Dispose()
$penGrid.Dispose(); $penAxis.Dispose()

Write-Output $outPath
