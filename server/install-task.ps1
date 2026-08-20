<#
    Registra o servidor do Life como tarefa agendada do usuário atual.

    Tarefa agendada e não serviço do Windows: serviço exige elevação, roda na
    conta SYSTEM e ficaria de pé antes do logon, sem enxergar a pasta do
    OneDrive do usuário. Como o servidor só precisa existir enquanto alguém
    está usando o computador, "ao fazer logon" é o gatilho honesto — e não pede
    senha nem privilégio de administrador.
#>

$ErrorActionPreference = 'Stop'

$taskName = 'Life - servidor local'
$here     = Split-Path -Parent $MyInvocation.MyCommand.Path
$vbs      = Join-Path $here 'launch-hidden.vbs'
$root     = Split-Path -Parent $here

Write-Host ''
Write-Host '  Life - instalar inicializacao automatica' -ForegroundColor Cyan
Write-Host ''

if (-not (Test-Path $vbs)) {
    throw "Nao encontrei $vbs"
}

# Sem build, o servidor sobe e morre reclamando de index.html ausente. Melhor
# gerar agora do que deixar a pessoa descobrir no proximo logon.
if (-not (Test-Path (Join-Path $root 'dist\index.html'))) {
    Write-Host '  Nao existe build ainda. Gerando (demora um pouco)...' -ForegroundColor Yellow
    Push-Location $root
    try {
        if (-not (Test-Path 'node_modules')) { & npm install }
        & npm run build
        if ($LASTEXITCODE -ne 0) { throw 'O build falhou; nada foi instalado.' }
    } finally {
        Pop-Location
    }
    Write-Host ''
}

$action = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument ('"{0}"' -f $vbs) -WorkingDirectory $root

$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
# Quinze segundos para o logon respirar antes de o node entrar na fila.
try { $trigger.Delay = 'PT15S' } catch { }

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1)

# O padrao do Windows encerra tarefa que passa de tres dias. Um servidor que
# vive ligado bateria nesse teto e sumiria sem explicacao.
$settings.ExecutionTimeLimit = 'PT0S'
$settings.DisallowStartIfOnBatteries = $false

$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $taskName `
    -Action $action -Trigger $trigger -Settings $settings -Principal $principal `
    -Description 'Mantem o servidor local do Life no ar para o app abrir em http://localhost:5173' `
    -Force | Out-Null

Write-Host "  [ok] Tarefa '$taskName' registrada." -ForegroundColor Green

# Nao faz sentido pedir para a pessoa reiniciar o Windows so para ver funcionar.
Write-Host '  Iniciando o servidor agora...'
Start-ScheduledTask -TaskName $taskName

$alvo = 'http://127.0.0.1:5173/__health'
$pronto = $false
foreach ($tentativa in 1..20) {
    Start-Sleep -Milliseconds 500
    try {
        $resposta = Invoke-RestMethod -Uri $alvo -TimeoutSec 2
        if ($resposta.ok) { $pronto = $true; break }
    } catch { }
}

Write-Host ''
if ($pronto) {
    Write-Host '  [ok] Servidor no ar em http://localhost:5173' -ForegroundColor Green
    Write-Host ''
    Write-Host '  A partir de agora ele sobe sozinho a cada logon, sem janela'
    Write-Host '  nenhuma, e se cair volta em segundos. Abra o Life pelo icone'
    Write-Host '  do PWA normalmente.'
} else {
    Write-Host '  [!] A tarefa foi criada, mas o servidor nao respondeu.' -ForegroundColor Yellow
    Write-Host "  Veja o motivo em: $here\life-server.log"
}
Write-Host ''
