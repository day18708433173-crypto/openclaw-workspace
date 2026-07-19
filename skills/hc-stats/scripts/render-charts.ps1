# HC progress chart (System.Drawing, Chinese via JSON strings)
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

$jobs = @($data.jobs)
if ($jobs.Count -eq 0) {
  $jobs = @([pscustomobject]@{
    name = "N/A"; target = 0; accepted = 0; gap = 0
    waitingR1 = 0; waitingR2 = 0; waitingOffer = 0
  })
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
$fontValue = New-ChartFont -Name "Microsoft YaHei UI" -Size 9 -Style Bold
$fontLegend = New-ChartFont -Name "Microsoft YaHei UI" -Size 9

$brushTitle = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(15, 23, 42))
$brushSub = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(100, 116, 139))
$brushLabel = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(51, 65, 85))
$penGrid = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(226, 232, 240)), 1
$penAxis = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(148, 163, 184)), 2
$brushCard = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
$brushTarget = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(37, 99, 235))
$brushAccepted = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(16, 185, 129))
$brushR1 = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(59, 130, 246))
$brushR2 = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(14, 165, 233))
$brushOffer = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(245, 158, 11))

$g.DrawString($Title, $fontTitle, $brushTitle, 40, 24)
$subtitle = [string]$data.subtitle
if (-not $subtitle) { $subtitle = "目标 & 已接受  ·  在途构成" }
$g.DrawString($subtitle, $fontSub, $brushSub, 40, 58)

function Get-CountAxisMax([double]$n) {
  return [Math]::Max(1, [Math]::Ceiling([Math]::Max(0, $n) / 4.0)) * 4.0
}

function Fill-RoundRect {
  param($x, $y, $w, $h, $r, $brush)
  if ($w -le 0 -or $h -le 0) { return }
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $rr = [Math]::Min($r, [Math]::Min($w, $h) / 2)
  if ($rr -lt 1) {
    $g.FillRectangle($brush, $x, $y, $w, $h)
    return
  }
  $path.AddArc($x, $y, $rr, $rr, 180, 90)
  $path.AddArc($x + $w - $rr, $y, $rr, $rr, 270, 90)
  $path.AddArc($x + $w - $rr, $y + $h - $rr, $rr, $rr, 0, 90)
  $path.AddArc($x, $y + $h - $rr, $rr, $rr, 90, 90)
  $path.CloseFigure()
  $g.FillPath($brush, $path)
}

function Get-NumOrZero($v) {
  if ($null -eq $v) { return 0.0 }
  $s = [string]$v
  if ($s -eq "" -or $s -eq "?") { return 0.0 }
  return [double]$v
}

# Left panel: target vs accepted grouped bars
$lx = 32; $ly = 100; $lw = 452; $lh = 560
Fill-RoundRect $lx $ly $lw $lh 12 $brushCard
$leftTitle = if ($data.leftTitle) { [string]$data.leftTitle } else { "目标 vs 已接受" }
$g.DrawString($leftTitle, $fontPanel, $brushTitle, ($lx + 20), ($ly + 16))

# legend
$g.FillRectangle($brushTarget, ($lx + 220), ($ly + 20), 12, 12)
$g.DrawString("目标", $fontLegend, $brushLabel, ($lx + 236), ($ly + 17))
$g.FillRectangle($brushAccepted, ($lx + 290), ($ly + 20), 12, 12)
$g.DrawString("已接受", $fontLegend, $brushLabel, ($lx + 306), ($ly + 17))

$plotX = $lx + 48
$plotY = $ly + 56
$plotW = $lw - 72
$plotH = $lh - 120

$maxLeft = 0.0
foreach ($j in $jobs) {
  $t = Get-NumOrZero $j.target
  $a = Get-NumOrZero $j.accepted
  if ($t -gt $maxLeft) { $maxLeft = $t }
  if ($a -gt $maxLeft) { $maxLeft = $a }
}
$maxVal = Get-CountAxisMax $maxLeft

for ($i = 0; $i -le 4; $i++) {
  $gy = $plotY + $plotH - ($plotH * $i / 4.0)
  $g.DrawLine($penGrid, $plotX, $gy, ($plotX + $plotW), $gy)
  $lab = "{0}" -f [Math]::Round($maxVal * $i / 4.0)
  $g.DrawString($lab, $fontAxis, $brushSub, ($lx + 10), ($gy - 8))
}
$g.DrawLine($penAxis, $plotX, ($plotY + $plotH), ($plotX + $plotW), ($plotY + $plotH))

$n = [Math]::Max(1, $jobs.Count)
$groupGap = 18
$groupW = [Math]::Max(36, [Math]::Min(90, ($plotW - $groupGap * ($n + 1)) / $n))
$barGap = 4
$barW = [Math]::Max(12, ($groupW - $barGap) / 2)
$totalGroupsW = $n * $groupW + ($n - 1) * $groupGap
$startX = $plotX + ($plotW - $totalGroupsW) / 2

for ($i = 0; $i -lt $jobs.Count; $i++) {
  $j = $jobs[$i]
  $targetStr = if ($null -eq $j.target) { "" } else { [string]$j.target }
  $hasTarget = ($targetStr -ne "") -and ($targetStr -ne "?")
  $target = if ($hasTarget) { [double]$j.target } else { 0.0 }
  $accepted = Get-NumOrZero $j.accepted
  $gx = $startX + $i * ($groupW + $groupGap)

  # target bar
  if ($hasTarget) {
    $bh = [Math]::Max(2, [Math]::Round(($target / $maxVal) * $plotH))
    $bx = $gx
    $by = $plotY + $plotH - $bh
    Fill-RoundRect $bx $by $barW $bh 5 $brushTarget
    $vText = "{0}" -f [Math]::Round($target)
    $vSize = $g.MeasureString($vText, $fontValue)
    $g.DrawString($vText, $fontValue, $brushLabel, ($bx + ($barW - $vSize.Width) / 2), ($by - 16))
  } else {
    $vText = "?"
    $vSize = $g.MeasureString($vText, $fontValue)
    $g.DrawString($vText, $fontValue, $brushSub, ($gx + ($barW - $vSize.Width) / 2), ($plotY + $plotH - 28))
  }

  # accepted bar
  $bh2 = [Math]::Max(2, [Math]::Round(($accepted / $maxVal) * $plotH))
  $bx2 = $gx + $barW + $barGap
  $by2 = $plotY + $plotH - $bh2
  Fill-RoundRect $bx2 $by2 $barW $bh2 5 $brushAccepted
  $vText2 = "{0}" -f [Math]::Round($accepted)
  $vSize2 = $g.MeasureString($vText2, $fontValue)
  $g.DrawString($vText2, $fontValue, $brushLabel, ($bx2 + ($barW - $vSize2.Width) / 2), ($by2 - 16))

  $lText = [string]$j.name
  if ($lText.Length -gt 6) { $lText = $lText.Substring(0, 6) }
  $lSize = $g.MeasureString($lText, $fontLabel)
  $g.DrawString($lText, $fontLabel, $brushLabel, ($gx + ($groupW - $lSize.Width) / 2), ($plotY + $plotH + 10))
}

# Right panel: stacked pipeline bars
$rx = 516; $ry = 100; $rw = 452; $rh = 560
Fill-RoundRect $rx $ry $rw $rh 12 $brushCard
$rightTitle = if ($data.rightTitle) { [string]$data.rightTitle } else { "在途构成" }
$g.DrawString($rightTitle, $fontPanel, $brushTitle, ($rx + 20), ($ry + 16))

$g.FillRectangle($brushR1, ($rx + 180), ($ry + 20), 10, 10)
$g.DrawString("待一面", $fontLegend, $brushLabel, ($rx + 194), ($ry + 17))
$g.FillRectangle($brushR2, ($rx + 250), ($ry + 20), 10, 10)
$g.DrawString("待二面", $fontLegend, $brushLabel, ($rx + 264), ($ry + 17))
$g.FillRectangle($brushOffer, ($rx + 320), ($ry + 20), 10, 10)
$g.DrawString("待OFFER", $fontLegend, $brushLabel, ($rx + 334), ($ry + 17))

$rPlotX = $rx + 100
$rPlotY = $ry + 56
$rPlotW = $rw - 130
$rPlotH = $rh - 100

$maxStack = 0.0
foreach ($j in $jobs) {
  $sum = (Get-NumOrZero $j.waitingR1) + (Get-NumOrZero $j.waitingR2) + (Get-NumOrZero $j.waitingOffer)
  if ($sum -gt $maxStack) { $maxStack = $sum }
}
$maxStack = Get-CountAxisMax $maxStack

for ($i = 0; $i -le 4; $i++) {
  $gx = $rPlotX + ($rPlotW * $i / 4.0)
  $g.DrawLine($penGrid, $gx, $rPlotY, $gx, ($rPlotY + $rPlotH))
  $lab = "{0}" -f [Math]::Round($maxStack * $i / 4.0)
  $g.DrawString($lab, $fontAxis, $brushSub, ($gx - 6), ($rPlotY + $rPlotH + 6))
}
$g.DrawLine($penAxis, $rPlotX, ($rPlotY + $rPlotH), ($rPlotX + $rPlotW), ($rPlotY + $rPlotH))

$rowGap = 14
$rowH = [Math]::Max(22, [Math]::Min(48, ($rPlotH - $rowGap * ($n - 1)) / $n))
$totalRowsH = $n * $rowH + ($n - 1) * $rowGap
$rowStartY = $rPlotY + ($rPlotH - $totalRowsH) / 2

for ($i = 0; $i -lt $jobs.Count; $i++) {
  $j = $jobs[$i]
  $r1 = Get-NumOrZero $j.waitingR1
  $r2 = Get-NumOrZero $j.waitingR2
  $wo = Get-NumOrZero $j.waitingOffer
  $by = $rowStartY + $i * ($rowH + $rowGap)
  $cx = $rPlotX

  $segments = @(
    @{ v = $r1; b = $brushR1 },
    @{ v = $r2; b = $brushR2 },
    @{ v = $wo; b = $brushOffer }
  )
  foreach ($seg in $segments) {
    if ($seg.v -le 0) { continue }
    $bw = [Math]::Max(2, [Math]::Round(($seg.v / $maxStack) * $rPlotW))
    Fill-RoundRect $cx $by $bw $rowH 4 $seg.b
    if ($bw -ge 18) {
      $vt = "{0}" -f [Math]::Round($seg.v)
      $vs = $g.MeasureString($vt, $fontValue)
      $brushWhite = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
      $g.DrawString($vt, $fontValue, $brushWhite, ($cx + ($bw - $vs.Width) / 2), ($by + ($rowH - $vs.Height) / 2))
      $brushWhite.Dispose()
    }
    $cx += $bw
  }

  $name = [string]$j.name
  if ($name.Length -gt 6) { $name = $name.Substring(0, 6) }
  $nSize = $g.MeasureString($name, $fontLabel)
  $g.DrawString($name, $fontLabel, $brushLabel, ($rPlotX - 12 - $nSize.Width), ($by + ($rowH - $nSize.Height) / 2))

  $totalPipe = $r1 + $r2 + $wo
  $tText = "{0}" -f [Math]::Round($totalPipe)
  $g.DrawString($tText, $fontValue, $brushLabel, ($cx + 6), ($by + ($rowH - 14) / 2))
}

$outPath = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Out)
$dir = Split-Path -Parent $outPath
if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
$bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)

$g.Dispose(); $bmp.Dispose()
$fontTitle.Dispose(); $fontSub.Dispose(); $fontPanel.Dispose(); $fontAxis.Dispose(); $fontLabel.Dispose(); $fontValue.Dispose(); $fontLegend.Dispose()
$brushTitle.Dispose(); $brushSub.Dispose(); $brushLabel.Dispose(); $brushCard.Dispose()
$brushTarget.Dispose(); $brushAccepted.Dispose(); $brushR1.Dispose(); $brushR2.Dispose(); $brushOffer.Dispose()
$penGrid.Dispose(); $penAxis.Dispose()

Write-Output $outPath
