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
If runtime = "" Then runtime = shell.ExpandEnvironmentStrings("%USERPROFILE%") & "\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
If Not files.FileExists(runtime) Then
  MsgBox "Node.js runtime was not found. Please install Node.js and try again.", 48, "Tidewater"
  WScript.Quit 1
End If
If Not files.FileExists(root & "\dist\index.html") Then
  MsgBox "The dist folder is missing. Please extract the full browser package before starting.", 48, "Tidewater"
  WScript.Quit 1
End If
shell.CurrentDirectory = root
command = Chr(34) & runtime & Chr(34) & " " & Chr(34) & root & "\scripts\serve.mjs" & Chr(34) & " --open"
shell.Run command, 0, False
