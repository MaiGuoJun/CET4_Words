Option Explicit

Dim shell, projectDirectory, nodeExecutable, ollamaExecutable, modelDirectory
Dim ollamaCommand, appCommand

Set shell = CreateObject("WScript.Shell")

projectDirectory = shell.ExpandEnvironmentStrings("%USERPROFILE%\Documents\蘑菇酱文档\蘑菇酱四级")
nodeExecutable = "C:\New Folder\node.exe"
ollamaExecutable = "D:\Apps\Ollama\ollama.exe"
modelDirectory = "D:\OllamaModels"

shell.Environment("PROCESS")("OLLAMA_MODELS") = modelDirectory
ollamaCommand = Chr(34) & ollamaExecutable & Chr(34) & " serve"
shell.Run ollamaCommand, 0, False

' Give Ollama a short head start; duplicate serve attempts safely exit when the
' desktop app already owns port 11434.
WScript.Sleep 3000

appCommand = Chr(34) & nodeExecutable & Chr(34) & " " & Chr(34) & projectDirectory & "\server.mjs" & Chr(34)
shell.CurrentDirectory = projectDirectory
shell.Run appCommand, 0, False
