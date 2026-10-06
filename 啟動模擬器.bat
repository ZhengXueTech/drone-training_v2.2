@echo off
chcp 65001 >nul
title newdrone server
cd /d "%~dp0"

rem 有 Python 用 Python（tools\serve.py），沒有就用 Windows 內建 PowerShell
rem （tools\serve.ps1）——兩者行為相同（no-cache 靜態伺服器），都免額外安裝。
set PY=
where py >nul 2>nul && set PY=py
if not defined PY where python >nul 2>nul && set PY=python

start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep 2; Start-Process 'http://localhost:8765/index.html'"

if defined PY (
  echo ============================================
  echo   newdrone 本機伺服器（%PY%・no-cache 版）
  echo   兩秒後自動開啟瀏覽器：
  echo   http://localhost:8765/index.html
  echo   沒開的話，手動把上面網址貼到瀏覽器即可
  echo   ＊關閉此視窗＝停止伺服器＊
  echo ============================================
  %PY% tools\serve.py 8765
) else (
  echo ============================================
  echo   newdrone 免安裝伺服器（Windows 內建 PowerShell）
  echo   這台電腦沒有 Python——沒關係，不用安裝任何東西！
  echo   兩秒後自動開啟瀏覽器：
  echo   http://localhost:8765/index.html
  echo   沒開的話，手動把上面網址貼到瀏覽器即可
  echo   ＊關閉此視窗＝停止伺服器＊
  echo ============================================
  powershell -NoProfile -ExecutionPolicy Bypass -File "tools\serve.ps1" 8765
)

echo.
echo [!] 伺服器已停止（若上方有錯誤訊息，常見原因：8765 埠被占用——關掉舊視窗再試）
pause
