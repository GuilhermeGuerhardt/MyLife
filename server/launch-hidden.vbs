' Sobe o supervisor do Life sem nenhuma janela.
'
' É a única razão de este arquivo existir: o Agendador de Tarefas até tem a
' opção "executar estando o usuário conectado ou não", mas ela exige guardar a
' senha da conta. Chamar o node por aqui com o estilo de janela 0 resolve o
' mesmo problema sem senha nenhuma — nada pisca na tela, nem no logon.

Option Explicit

Dim shell, fso, aqui, raiz, nodeExe, comando

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

aqui = fso.GetParentFolderName(WScript.ScriptFullName)
raiz = fso.GetParentFolderName(aqui)

nodeExe = AcharNode(shell, fso)

' O diretório de trabalho é a raiz do projeto: o supervisor resolve os caminhos
' a partir do próprio arquivo, mas um log relativo cairia em System32 sem isto.
shell.CurrentDirectory = raiz

comando = """" & nodeExe & """ """ & aqui & "\supervisor.mjs"""

On Error Resume Next
shell.Run comando, 0, False
If Err.Number <> 0 Then
  Registrar fso, aqui, "não consegui iniciar o node (" & nodeExe & "): " & Err.Description
End If
On Error GoTo 0

' ---------------------------------------------------------------------------

' Procura o node em locais conhecidos antes de confiar no PATH.
'
' Testar arquivo com o FileSystemObject não cria processo nenhum. Descobrir o
' caminho com "where node" criaria — e um console piscando no logon é
' exatamente o que este arquivo existe para evitar.
Function AcharNode(shell, fso)
  Dim candidatos, caminho, i
  candidatos = Array( _
    "%ProgramFiles%\nodejs\node.exe", _
    "%ProgramFiles(x86)%\nodejs\node.exe", _
    "%LOCALAPPDATA%\Programs\nodejs\node.exe", _
    "%LOCALAPPDATA%\Volta\bin\node.exe", _
    "%APPDATA%\fnm\aliases\default\node.exe" _
  )

  For i = 0 To UBound(candidatos)
    caminho = shell.ExpandEnvironmentStrings(candidatos(i))
    If fso.FileExists(caminho) Then
      AcharNode = caminho
      Exit Function
    End If
  Next

  ' Nenhum dos lugares usuais: sobra o PATH, que é o caso de quem usa nvm.
  AcharNode = "node.exe"
End Function

Sub Registrar(fso, aqui, mensagem)
  Dim log
  On Error Resume Next
  Set log = fso.OpenTextFile(aqui & "\life-server.log", 8, True)
  log.WriteLine Now & " !! " & mensagem
  log.Close
End Sub
