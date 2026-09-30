Option Explicit
Dim shell, files, root, runtime, finder, candidate, command
Set shell = CreateObject("WScript.Shell")
Set files = CreateObject("Scripting.FileSystemObject")
root = files.GetParentFolderName(WScript.ScriptFullName)
runtime = ""
On Error Resume Next
Set finder = shell.Exec("where.exe node")
If Err.Number = 0 Then
  Do Until finder.StdOut.AtEndOfStream
    candidate = Trim(finder.StdOut.ReadLine)
    If files.FileExists(candidate) Then
      runtime = candidate
      Exit Do
    End If
  Loop
End If
On Error GoTo 0
If runtime = "" Then
  candidate = shell.ExpandEnvironmentStrings("%USERPROFILE%") & "\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
  If files.FileExists(candidate) Then runtime = candidate
End If
If runtime = "" Then
  MsgBox "Node.js runtime was not found. Please install Node.js (https://nodejs.org/) and try again.", 48, "Tidewater"
  WScript.Quit 1
End If
If Not files.FileExists(root & "\dist\index.html") Then
  If Not files.FolderExists(root & "\node_modules") Then
    shell.Run "cmd.exe /c cd /d " & Chr(34) & root & Chr(34) & " && npm.cmd install --no-audit --no-fund", 1, True
  End If
  shell.Run "cmd.exe /c cd /d " & Chr(34) & root & Chr(34) & " && npm.cmd run build", 1, True
  If Not files.FileExists(root & "\dist\index.html") Then
    MsgBox "Failed to build the game. Please run ""npm install"" and ""npm run build"" in the project folder, then start it again.", 48, "Tidewater"
    WScript.Quit 1
  End If
End If
shell.CurrentDirectory = root
command = Chr(34) & runtime & Chr(34) & " " & Chr(34) & root & "\scripts\serve.mjs" & Chr(34) & " --open"
shell.Run command, 0, False
