@echo off
chcp 65001 >nul
title Life
cd /d "%~dp0"

:menu
cls
echo.
echo    ─── Life ──────────────────────────────────────
echo.
call :status
echo.
echo      [1]  Atualizar o app ^(gerar build novo^)
echo      [2]  Instalar inicialização automática
echo      [3]  Remover inicialização automática
echo      [4]  Abrir o log do servidor
echo      [5]  Modo desenvolvimento ^(porta 5174^)
echo      [S]  Sair
echo.

choice /c 12345S /n /m "    Escolha uma opção: "
if errorlevel 6 exit /b 0
if errorlevel 5 goto dev
if errorlevel 4 goto log
if errorlevel 3 goto remover
if errorlevel 2 goto instalar
if errorlevel 1 goto atualizar
goto menu

:: ---------------------------------------------------------------------------

:status
powershell -NoProfile -Command ^
  "$t = Get-ScheduledTask -TaskName 'Life - servidor local' -ErrorAction SilentlyContinue;" ^
  "try { $h = Invoke-RestMethod 'http://127.0.0.1:5173/__health' -TimeoutSec 2 } catch { $h = $null };" ^
  "if ($h) { Write-Host '    Servidor:  no ar em http://localhost:5173' -ForegroundColor Green }" ^
  "else { Write-Host '    Servidor:  fora do ar' -ForegroundColor Red };" ^
  "if ($t) { Write-Host '    Ao ligar:  configurado' -ForegroundColor Green }" ^
  "else { Write-Host '    Ao ligar:  nao configurado (use a opcao 2)' -ForegroundColor Yellow }"
exit /b 0

:atualizar
cls
echo.
echo    Gerando o build. O servidor serve direto do disco,
echo    entao nao e preciso reiniciar nada depois.
echo.
call npm run build:web
if errorlevel 1 (
  echo.
  echo    [ERRO] O build falhou. Nada mudou: o app continua
  echo    na versao anterior. Se faltam dependencias, use a
  echo    opcao 2, que instala tudo antes de configurar.
) else (
  echo.
  echo    [ok] Pronto. Abra o Life e deixe aberto alguns
  echo    segundos: ele percebe a versao nova sozinho.
)
echo.
pause
goto menu

:instalar
cls
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server\install-task.ps1"
pause
goto menu

:remover
cls
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server\uninstall-task.ps1"
pause
goto menu

:log
if exist "server\life-server.log" (
  start "" notepad "server\life-server.log"
) else (
  echo.
  echo    Ainda nao ha log: o servidor nunca foi iniciado.
  echo.
  pause
)
goto menu

:dev
cls
echo.
echo    Modo desenvolvimento na porta 5174.
echo.
echo    Porta separada de proposito: o app instalado vive na
echo    5173 e, com o cache do navegador ativo, e ele quem
echo    responde ali — suas mudancas nao apareceriam.
echo.
echo    Para parar: Ctrl+C ou feche esta janela.
echo.
if not exist "node_modules" call npm install
call npm run dev:web -- --open
echo.
pause
goto menu
