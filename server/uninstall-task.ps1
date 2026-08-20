<#
    Desfaz o que install-task.ps1 fez: para o servidor e remove a tarefa.

    Existe para a instalacao ser reversivel sem caca ao tesouro no Agendador de
    Tarefas. Nao apaga dado nenhum do app.
#>

$ErrorActionPreference = 'Stop'

$taskName = 'Life - servidor local'

Write-Host ''
Write-Host '  Life - remover inicializacao automatica' -ForegroundColor Cyan
Write-Host ''

$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($task) {
    Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    Write-Host "  [ok] Tarefa '$taskName' removida." -ForegroundColor Green
} else {
    Write-Host '  A tarefa nao estava registrada.' -ForegroundColor Yellow
}

# Parar a tarefa nao mata o node: quem o iniciou foi o wscript, que ja terminou.
# Sem esta parte o servidor seguiria no ar ate o proximo reinicio do Windows.
$mortos = 0
foreach ($proc in Get-CimInstance Win32_Process -Filter "Name = 'node.exe'") {
    if ($proc.CommandLine -and ($proc.CommandLine -match 'supervisor\.mjs|static-server\.mjs')) {
        Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
        $mortos++
    }
}

if ($mortos -gt 0) {
    Write-Host "  [ok] $mortos processo(s) do servidor encerrado(s)." -ForegroundColor Green
} else {
    Write-Host '  Nenhum processo do servidor estava rodando.'
}

Write-Host ''
Write-Host '  O app instalado continua abrindo do cache offline. Para voltar a'
Write-Host '  ter o servidor, rode "Instalar inicializacao.cmd" de novo.'
Write-Host ''
