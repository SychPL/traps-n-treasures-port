# Traps 'n Treasures: a minimal local web server for the game (Windows PowerShell, nothing to install).
# Serves this folder on http://127.0.0.1:8435/ (the next free port if taken) and opens the game in the browser.
# Started by start.bat; Ctrl+C or closing the window stops it. Only this computer can connect (loopback).
param([int]$Port = 8435, [switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$root = [System.IO.Path]::GetFullPath($PSScriptRoot).TrimEnd('\') + '\'
$types = @{ '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.mjs' = 'text/javascript; charset=utf-8'
  '.json' = 'application/json'; '.png' = 'image/png'; '.css' = 'text/css'; '.wasm' = 'application/wasm'; '.svg' = 'image/svg+xml'
  '.ico' = 'image/x-icon'; '.md' = 'text/plain; charset=utf-8'; '.txt' = 'text/plain; charset=utf-8' }

$listener = $null
for ($p = $Port; $p -lt $Port + 20 -and -not $listener; $p++) {
  try { $l = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $p); $l.Start(); $listener = $l; $Port = $p } catch {}
}
if (-not $listener) { Write-Host "No free port from $Port"; exit 1 }
$url = "http://127.0.0.1:$Port/game/"
Write-Host "Traps 'n Treasures: $url"
Write-Host "Extractor page: http://127.0.0.1:$Port/extractor/"
Write-Host 'Ctrl+C (or closing this window) stops the server.'
if (-not $NoBrowser) { Start-Process $url }

function Send($stream, [int]$code, [string]$status, [string]$type, [byte[]]$body, [string]$extra = '', [bool]$head = $false) {
  $h = "HTTP/1.1 $code $status`r`nContent-Type: $type`r`nContent-Length: $($body.Length)`r`nCache-Control: no-cache`r`nConnection: close`r`n$extra`r`n"
  $hb = [System.Text.Encoding]::ASCII.GetBytes($h)
  $stream.Write($hb, 0, $hb.Length)
  if (-not $head -and $body.Length) { $stream.Write($body, 0, $body.Length) }
}

try {
  while ($true) {
    while (-not $listener.Pending()) { Start-Sleep -Milliseconds 20 }   # stays responsive to Ctrl+C
    $client = $listener.AcceptTcpClient()
    try {
      $stream = $client.GetStream(); $stream.ReadTimeout = 5000
      $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII, $false, 4096, $true)
      $line = $reader.ReadLine()
      while ($true) { $h = $reader.ReadLine(); if ($null -eq $h -or $h -eq '') { break } }
      $parts = "$line" -split ' '
      if ($parts.Count -lt 2) { continue }
      $method = $parts[0]; $path = [Uri]::UnescapeDataString(($parts[1] -split '[?#]')[0])
      $empty = [byte[]]::new(0)
      if ($method -ne 'GET' -and $method -ne 'HEAD') { Send $stream 405 'Method Not Allowed' 'text/plain' $empty; continue }
      $file = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($root, $path.TrimStart('/').Replace('/', '\')))
      if (-not ($file + '\').StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) {   # nothing outside this folder
        Send $stream 403 'Forbidden' 'text/plain' $empty; continue
      }
      if ([System.IO.Directory]::Exists($file)) {
        if (-not $path.EndsWith('/')) {
          $q = $parts[1].IndexOf('?'); $loc = if ($q -ge 0) { $parts[1].Substring(0, $q) + '/' + $parts[1].Substring($q) } else { $parts[1] + '/' }
          Send $stream 301 'Moved Permanently' 'text/plain' $empty "Location: $loc`r`n"; continue
        }
        $file = [System.IO.Path]::Combine($file, 'index.html')
      }
      if (-not [System.IO.File]::Exists($file)) { Send $stream 404 'Not Found' 'text/plain' ([System.Text.Encoding]::ASCII.GetBytes('not found')) '' ($method -eq 'HEAD'); continue }
      $type = $types[[System.IO.Path]::GetExtension($file).ToLowerInvariant()]
      if (-not $type) { $type = 'application/octet-stream' }
      Send $stream 200 'OK' $type ([System.IO.File]::ReadAllBytes($file)) '' ($method -eq 'HEAD')
    } catch {
      try { Send $stream 500 'Internal Server Error' 'text/plain' ([byte[]]::new(0)) } catch {}
    } finally { $client.Close() }
  }
} finally { $listener.Stop() }
