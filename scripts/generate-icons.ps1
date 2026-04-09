Add-Type -AssemblyName System.Drawing

function New-RoundedRectPath {
  param(
    [float]$X,
    [float]$Y,
    [float]$Width,
    [float]$Height,
    [float]$Radius
  )

  $diameter = $Radius * 2
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddArc($X, $Y, $diameter, $diameter, 180, 90)
  $path.AddArc(($X + $Width - $diameter), $Y, $diameter, $diameter, 270, 90)
  $path.AddArc(($X + $Width - $diameter), ($Y + $Height - $diameter), $diameter, $diameter, 0, 90)
  $path.AddArc($X, ($Y + $Height - $diameter), $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

function New-ZNBlockerIcon {
  param(
    [int]$Size,
    [string]$OutputPath
  )

  $bitmap = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear([System.Drawing.Color]::Transparent)

  $padding = [Math]::Max([int]($Size * 0.08), 1)
  $iconSize = $Size - ($padding * 2)
  $radius = [Math]::Max([int]($Size * 0.22), 2)

  $backgroundPath = New-RoundedRectPath -X $padding -Y $padding -Width $iconSize -Height $iconSize -Radius $radius
  $backgroundRect = New-Object System.Drawing.Rectangle($padding, $padding, $iconSize, $iconSize)

  $gradStart = [System.Drawing.ColorTranslator]::FromHtml("#0f8f83")
  $gradEnd = [System.Drawing.ColorTranslator]::FromHtml("#1368d6")
  $backgroundBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($backgroundRect, $gradStart, $gradEnd, 42)
  $graphics.FillPath($backgroundBrush, $backgroundPath)

  $glowRect = New-Object System.Drawing.RectangleF(($Size * 0.18), ($Size * 0.14), ($Size * 0.64), ($Size * 0.5))
  $glowBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($glowRect, [System.Drawing.Color]::FromArgb(130, 255, 255, 255), [System.Drawing.Color]::FromArgb(10, 255, 255, 255), 90)
  $graphics.FillEllipse($glowBrush, $glowRect)

  $borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(155, 255, 255, 255), [Math]::Max(($Size * 0.02), 1.0))
  $graphics.DrawPath($borderPen, $backgroundPath)

  $shieldPath = New-Object System.Drawing.Drawing2D.GraphicsPath
  $shieldPoints = [System.Drawing.PointF[]]@(
    (New-Object System.Drawing.PointF(($Size * 0.5), ($Size * 0.25))),
    (New-Object System.Drawing.PointF(($Size * 0.72), ($Size * 0.35))),
    (New-Object System.Drawing.PointF(($Size * 0.66), ($Size * 0.64))),
    (New-Object System.Drawing.PointF(($Size * 0.5), ($Size * 0.79))),
    (New-Object System.Drawing.PointF(($Size * 0.34), ($Size * 0.64))),
    (New-Object System.Drawing.PointF(($Size * 0.28), ($Size * 0.35)))
  )
  $shieldPath.AddPolygon($shieldPoints)

  $shieldBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(235, 255, 255, 255))
  $graphics.FillPath($shieldBrush, $shieldPath)

  $checkPen = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml("#0f8f83"), [Math]::Max(($Size * 0.06), 2.0))
  $checkPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $checkPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $checkPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round

  $checkPoints = [System.Drawing.PointF[]]@(
    (New-Object System.Drawing.PointF(($Size * 0.41), ($Size * 0.53))),
    (New-Object System.Drawing.PointF(($Size * 0.49), ($Size * 0.61))),
    (New-Object System.Drawing.PointF(($Size * 0.62), ($Size * 0.46)))
  )
  $graphics.DrawLines($checkPen, $checkPoints)

  $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)

  $checkPen.Dispose()
  $shieldBrush.Dispose()
  $shieldPath.Dispose()
  $borderPen.Dispose()
  $glowBrush.Dispose()
  $backgroundBrush.Dispose()
  $backgroundPath.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}

$iconDir = Join-Path $PSScriptRoot "..\assets\icons"
if (-not (Test-Path -Path $iconDir)) {
  New-Item -Path $iconDir -ItemType Directory | Out-Null
}

foreach ($size in @(16, 32, 48, 128)) {
  $iconPath = Join-Path $iconDir "icon-$size.png"
  New-ZNBlockerIcon -Size $size -OutputPath $iconPath
  Write-Output "Generated $iconPath"
}