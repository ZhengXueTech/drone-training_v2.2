# ============================================================
#  serve.ps1 — 免安裝本機伺服器（Windows 內建 PowerShell 即可執行）
#  用途：電腦沒有安裝 Python 時，啟動模擬器.bat 會改用本檔案。
#  原理：TcpListener 手寫 HTTP 靜態檔案伺服器（刻意不用 HttpListener，
#        因為 HttpListener 非系統管理員需要 netsh urlacl 保留網址）。
#  no-store：與 tools/serve.py 相同，避免瀏覽器快取舊版模組
#  （見專案「模組快取陷阱」教訓）。
#  語法保持 Windows PowerShell 5.1 相容（勿用 ?? / 三元運算子）。
# ============================================================
param([int]$Port = 8765)

$root = Split-Path -Parent $PSScriptRoot   # tools\ 的上一層 = 專案根目錄
$mime = @{
  '.html'='text/html; charset=utf-8'
  '.js'  ='application/javascript; charset=utf-8'
  '.mjs' ='application/javascript; charset=utf-8'
  '.css' ='text/css; charset=utf-8'
  '.json'='application/json; charset=utf-8'
  '.svg' ='image/svg+xml'
  '.png' ='image/png'
  '.jpg' ='image/jpeg'
  '.gif' ='image/gif'
  '.ico' ='image/x-icon'
  '.wasm'='application/wasm'
  '.md'  ='text/plain; charset=utf-8'
  '.txt' ='text/plain; charset=utf-8'
}

try {
  $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $Port)
  $listener.Start()
} catch {
  Write-Host "[!] 無法使用連接埠 $Port（可能被占用）：關掉舊的伺服器視窗再試一次" -ForegroundColor Red
  Read-Host '按 Enter 結束'
  exit 1
}
Write-Host "newdrone 免安裝伺服器（PowerShell）已啟動" -ForegroundColor Green
Write-Host "  http://localhost:$Port/index.html"
Write-Host "  ＊關閉此視窗＝停止伺服器＊"

function Send-Bytes([System.Net.Sockets.NetworkStream]$stream, [string]$header, [byte[]]$body) {
  $hb = [System.Text.Encoding]::ASCII.GetBytes($header)
  $stream.Write($hb, 0, $hb.Length)
  if ($body -and $body.Length -gt 0) { $stream.Write($body, 0, $body.Length) }
}

$rootFull = [System.IO.Path]::GetFullPath($root)
while ($true) {
  $client = $listener.AcceptTcpClient()
  try {
    $stream = $client.GetStream()
    # 2026-09-30：3000→800ms。單執行緒伺服器遇到 Chrome 預先開的空連線會卡住等它，縮短等待避免畫面空白太久
    $stream.ReadTimeout = 800
    $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::ASCII, $false, 8192, $true)
    $req = $reader.ReadLine()
    while ($true) {                       # 讀掉其餘 request headers 直到空行
      $h = $reader.ReadLine()
      if ($null -eq $h -or $h -eq '') { break }
    }
    if ($req -and $req -match '^(GET|HEAD)\s+(\S+)') {
      $method = $Matches[1]
      $path = $Matches[2].Split('?')[0]
      $path = [System.Uri]::UnescapeDataString($path)
      if ($path -eq '/') { $path = '/index.html' }
      $file = Join-Path $root $path.TrimStart('/')   # Windows API 接受 / 分隔，毋須轉 \
      $full = ''
      try { $full = [System.IO.Path]::GetFullPath($file) } catch {}
      if ($full -and $full.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $full -PathType Leaf)) {
        $bytes = [System.IO.File]::ReadAllBytes($full)
        $ext = [System.IO.Path]::GetExtension($full).ToLower()
        $ct = $mime[$ext]
        if (-not $ct) { $ct = 'application/octet-stream' }
        $header = "HTTP/1.1 200 OK`r`nContent-Type: $ct`r`nContent-Length: $($bytes.Length)`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
        if ($method -eq 'HEAD') { Send-Bytes $stream $header $null }
        else { Send-Bytes $stream $header $bytes }
      } else {
        $nf = [System.Text.Encoding]::UTF8.GetBytes('404 Not Found')
        Send-Bytes $stream "HTTP/1.1 404 Not Found`r`nContent-Type: text/plain`r`nContent-Length: $($nf.Length)`r`nConnection: close`r`n`r`n" $nf
      }
    }
  } catch {} finally { $client.Close() }
}
