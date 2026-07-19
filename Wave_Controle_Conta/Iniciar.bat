@echo off
title Wave — Controle de Contas
cd /d "%~dp0"

echo.
echo  ================================================
echo   Wave - Controle de Contas
echo  ================================================
echo.

:: Verifica se Node.js esta instalado
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERRO] Node.js nao encontrado.
    echo  Instale em: https://nodejs.org
    echo.
    pause
    exit /b 1
)

:: Instala dependencias se necessario
if not exist "node_modules" (
    echo  Instalando dependencias pela primeira vez...
    echo.
    npm install
    echo.
)

echo  Servidor iniciando em http://localhost:3000
echo  Feche esta janela para encerrar o servidor.
echo.

:: Abre o navegador apos 2 segundos (em segundo plano)
start /b cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:3000"

:: Inicia o servidor (mantém a janela aberta com os logs)
node server.js

echo.
echo  Servidor encerrado.
pause
