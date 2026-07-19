# Channel stats chart (System.Drawing, Chinese via JSON strings)
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
$channels = @($data.channels | Where-Object { [int]$_.applied -gt 0 })
$hasData = $channels.Count -gt 0

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

$brushTitle = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(15, 23, 42))
$brushSub = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(100, 116, 139))
$brushLabel = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(51, 65, 85))
$penGrid = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(226, 232, 240)), 1
$penAxis = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(148, 163, 184)), 2
$brushCard = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
$brushBlue = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(37, 99, 235))
$brushGreen = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(16, 185, 129))

$g.DrawString($Title, $fontTitle, $brushTitle, 40, 24)
$subtitle = [string]$data.subtitle
if (-not $subtitle) { $subtitle = "Applications & Offer Rate" }
$g.DrawString($subtitle, $fontSub, $brushSub, 40, 58)

function Get-CountAxisMax([double]$n) {
  return [Math]::Max(1, [Math]::Ceiling([Math]::Max(0, $n) / 4.0)) * 4.0
}

function Draw-Panel {
  param($x, $y, $w, $h, $panelTitle, $labels, $values, $brushBar, [scriptblock]$fmt, $fixedMax)

  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $r = 12
  $path.AddArc($x, $y, $r, $r, 180, 90)
  $path.AddArc($x + $w - $r, $y, $r, $r, 270, 90)
  $path.AddArc($x + $w - $r, $y + $h - $r, $r, $r, 0, 90)
  $path.AddArc($x, $y + $h - $r, $r, $r, 90, 90)
  $path.CloseFigure()
  $g.FillPath($brushCard, $path)
  $g.DrawString($panelTitle, $fontPanel, $brushTitle, ($x + 20), ($y + 16))

  $plotX = $x + 56
  $plotY = $y + 56
  $plotW = $w - 80
  $plotH = $h - 120
  $maxVal = if ($fixedMax -and $fixedMax -gt 0) { [double]$fixedMax } else { Get-CountAxisMax (($values | Measure-Object -Maximum).Maximum) }

  for ($i = 0; $i -le 4; $i++) {
    $gy = $plotY + $plotH - ($plotH * $i / 4.0)
    $g.DrawLine($penGrid, $plotX, $gy, ($plotX + $plotW), $gy)
    $lab = & $fmt ($maxVal * $i / 4.0)
    $g.DrawString($lab, $fontAxis, $brushSub, ($x + 10), ($gy - 8))
  }
  $g.DrawLine($penAxis, $plotX, ($plotY + $plotH), ($plotX + $plotW), ($plotY + $plotH))

  $n = [Math]::Max(1, $labels.Count)
  $gap = 18
  $barW = [Math]::Max(20, [Math]::Min(56, ($plotW - $gap * ($n + 1)) / $n))
  $totalBarsW = $n * $barW + ($n - 1) * $gap
  $startX = $plotX + ($plotW - $totalBarsW) / 2

  for ($i = 0; $i -lt $labels.Count; $i++) {
    $val = [double]$values[$i]
    $bh = [Math]::Max(2, [Math]::Round(($val / $maxVal) * $plotH))
    $bx = $startX + $i * ($barW + $gap)
    $by = $plotY + $plotH - $bh

    $br = [Math]::Min(8, [Math]::Floor($barW / 2))
    if ($bh -lt $br) {
      $g.FillRectangle($brushBar, $bx, $by, $barW, $bh)
    } else {
      $barPath = New-Object System.Drawing.Drawing2D.GraphicsPath
      $barPath.AddArc($bx, $by, $br, $br, 180, 90)
      $barPath.AddArc(($bx + $barW - $br), $by, $br, $br, 270, 90)
      $barPath.AddLine(($bx + $barW), ($by + $br), ($bx + $barW), ($by + $bh))
      $barPath.AddLine(($bx + $barW), ($by + $bh), $bx, ($by + $bh))
      $barPath.AddLine($bx, ($by + $bh), $bx, ($by + $br))
      $barPath.CloseFigure()
      $g.FillPath($brushBar, $barPath)
    }

    $vText = & $fmt $val
    $vSize = $g.MeasureString($vText, $fontValue)
    $g.DrawString($vText, $fontValue, $brushLabel, ($bx + ($barW - $vSize.Width) / 2), ($by - 18))

    $lText = [string]$labels[$i]
    $lSize = $g.MeasureString($lText, $fontLabel)
    $g.DrawString($lText, $fontLabel, $brushLabel, ($bx + ($barW - $lSize.Width) / 2), ($plotY + $plotH + 10))
  }
}

$labels = @($channels | ForEach-Object { [string]$_.name })
$applied = @($channels | ForEach-Object { [double]$_.applied })
$rates = @($channels | ForEach-Object {
  $a = [double]$_.applied
  $o = [double]$_.offer
  if ($a -gt 0) { ($o / $a) * 100.0 } else { 0.0 }
})

$leftTitle = if ($data.leftTitle) { [string]$data.leftTitle } else { "Applied" }
$rightTitle = if ($data.rightTitle) { [string]$data.rightTitle } else { "Offer Rate" }

Draw-Panel 32 100 452 560 $leftTitle $labels $applied $brushBlue { param($v) "{0}" -f [Math]::Round($v) }
Draw-Panel 516 100 452 560 $rightTitle $labels $rates $brushGreen { param($v) "{0:N1}%" -f $v } 100

if (-not $hasData) {
  $emptyText = if ($data.emptyText) { [string]$data.emptyText } else { "No data" }
  $emptySize = $g.MeasureString($emptyText, $fontSub)
  $g.DrawString($emptyText, $fontSub, $brushSub, (32 + (452 - $emptySize.Width) / 2), (100 + (560 - $emptySize.Height) / 2))
  $g.DrawString($emptyText, $fontSub, $brushSub, (516 + (452 - $emptySize.Width) / 2), (100 + (560 - $emptySize.Height) / 2))
}

$outPath = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Out)
$dir = Split-Path -Parent $outPath
if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
$bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)

$g.Dispose(); $bmp.Dispose()
$fontTitle.Dispose(); $fontSub.Dispose(); $fontPanel.Dispose(); $fontAxis.Dispose(); $fontLabel.Dispose(); $fontValue.Dispose()
$brushTitle.Dispose(); $brushSub.Dispose(); $brushLabel.Dispose(); $brushCard.Dispose(); $brushBlue.Dispose(); $brushGreen.Dispose()
$penGrid.Dispose(); $penAxis.Dispose()

Write-Output $outPath
