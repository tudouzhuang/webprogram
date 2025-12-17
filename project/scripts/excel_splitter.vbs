' D:\codespace\web-program\project\scripts\excel_splitter.vbs
' V7.0 - The "Sweeper" Edition: Skip Failures & Collect Leftovers
Option Explicit

Dim args, sourcePath, outputDir
Set args = WScript.Arguments

If args.Count < 2 Then
    WScript.Echo "Error: Missing arguments."
    WScript.Quit 1
End If

sourcePath = args(0)
outputDir = args(1)

Dim objExcel, objWorkbook, fso
Dim sheetCount, successCount, failedCount, i, percent
Dim targetName, safeName, targetPath, methodUsed
Dim currentSheet
Dim successListStr ' 用于记录成功拆分的 Sheet 名字，格式 |Name1|Name2|

Set fso = CreateObject("Scripting.FileSystemObject")
If Not fso.FolderExists(outputDir) Then
    fso.CreateFolder(outputDir)
End If

' 初始化 Excel
Set objExcel = CreateObject("Excel.Application")
SetupExcelApp objExcel

On Error Resume Next

' 初次打开
Set objWorkbook = objExcel.Workbooks.Open(sourcePath, False, True, , , , True)
If Err.Number <> 0 Then
    WScript.Echo "Error opening file: " & Err.Description
    QuitScript 1
End If

objWorkbook.Unprotect
Err.Clear

sheetCount = objWorkbook.Sheets.Count
WScript.Echo "INFO: Total sheets: " & sheetCount

successCount = 0
failedCount = 0
successListStr = "|" ' 初始化分隔符

' =========================================================
' 阶段 1: 逐个拆分 (遇到困难就跳过)
' =========================================================
For i = 1 To sheetCount
    Err.Clear
    methodUsed = ""
    
    ' 1. 进程守护：如果 Excel 崩了，复活它
    If objExcel Is Nothing Then
        WScript.Echo "WARNING: Excel process died at index " & i & ". Resurrecting..."
        Set objExcel = CreateObject("Excel.Application")
        SetupExcelApp objExcel
        Set objWorkbook = objExcel.Workbooks.Open(sourcePath, False, True, , , , True)
        objWorkbook.Unprotect
    End If

    ' 2. 获取 Sheet
    On Error Resume Next
    Set currentSheet = objWorkbook.Sheets(i)
    
    ' 如果获取失败，说明 Sheet 索引出了大问题，或者文件损坏
    If Err.Number <> 0 Or currentSheet Is Nothing Then
        WScript.Echo "WARNING: Cannot access Sheet index " & i & ". Skipping..."
        failedCount = failedCount + 1
        ForceRestartExcel ' 重启一下保平安
    Else
        targetName = currentSheet.Name
        safeName = CleanFileName(targetName)
        targetPath = GetUniquePath(outputDir, safeName)
        
        ' 强制显示
        If currentSheet.Visible <> -1 Then
            currentSheet.Visible = -1
            Err.Clear
        End If
        
        ' --- 尝试策略 A: 标准复制 ---
        objExcel.CutCopyMode = False
        currentSheet.Copy
        
        If Err.Number = 0 Then
            Dim newWbA
            Set newWbA = objExcel.ActiveWorkbook
            newWbA.SaveAs targetPath, 51
            newWbA.Close False
            methodUsed = "DirectCopy"
        Else
            ' --- 尝试策略 B: 值传递 (不崩才是硬道理) ---
            Err.Clear
            Dim newWbB, targetSheet, srcRange
            Set newWbB = objExcel.Workbooks.Add
            Set targetSheet = newWbB.Sheets(1)
            Set srcRange = currentSheet.UsedRange
            
            ' 尝试带格式粘贴
            srcRange.Copy
            targetSheet.Range(srcRange.Address).PasteSpecial -4104 ' xlPasteAll
            
            If Err.Number = 0 Then
                 methodUsed = "CopyPaste"
            Else
                 ' --- 尝试策略 C: 纯值 (底线) ---
                 Err.Clear
                 targetSheet.Range(srcRange.Address).Value = srcRange.Value
                 If Err.Number = 0 Then methodUsed = "ValuesOnly"
            End If
            
            If methodUsed <> "" Then
                 On Error Resume Next
                 targetSheet.Name = Left(safeName, 31)
                 On Error Resume Next
                 newWbB.SaveAs targetPath, 51
                 newWbB.Close False
            Else
                 newWbB.Close False
                 WScript.Echo "ERROR: All strategies failed for [" & targetName & "]. Skipping."
            End If
        End If
        
        ' --- 结果记录 ---
        If methodUsed <> "" Then
            WScript.Echo "SUCCESS: Saved [" & targetName & "] -> " & fso.GetFileName(targetPath) & " (Method: " & methodUsed & ")"
            successCount = successCount + 1
            ' 【关键】记录成功的名字，用于后续排除
            successListStr = successListStr & targetName & "|"
        Else
            failedCount = failedCount + 1
        End If
    End If
    
    ' 进度
    percent = Int((i / sheetCount) * 100)
    WScript.Echo "PROGRESS: " & percent
    
    objExcel.CutCopyMode = False
Next

' 关闭源文件，准备扫尾
If Not objWorkbook Is Nothing Then objWorkbook.Close False
If Not objExcel Is Nothing Then objExcel.Quit
Set objExcel = Nothing

' =========================================================
' 阶段 2: 扫尾工作 (打包剩余的失败表)
' =========================================================
If failedCount > 0 Then
    WScript.Echo "INFO: Generating composite file for " & failedCount & " failed sheets..."
    
    Set objExcel = CreateObject("Excel.Application")
    SetupExcelApp objExcel
    
    ' 重新打开源文件
    Set objWorkbook = objExcel.Workbooks.Open(sourcePath, False, True, , , , True)
    objWorkbook.Unprotect
    
    Dim delSheet, j
    ' 倒序遍历删除
    For j = objWorkbook.Sheets.Count To 1 Step -1
        Set delSheet = objWorkbook.Sheets(j)
        Dim checkName
        checkName = "|" & delSheet.Name & "|"
        
        ' 如果这个表之前成功了，就删掉它
        If InStr(successListStr, checkName) > 0 Then
            On Error Resume Next
            ' 必须保证至少留一张表，否则删除最后一张会报错
            If objWorkbook.Sheets.Count > 1 Then
                delSheet.Visible = -1 ' 必须可见才能删
                delSheet.Delete
            End If
            On Error Goto 0
        End If
    Next
    
    ' 保存剩余文件
    Dim leftoverPath
    leftoverPath = outputDir & "\_需要人工处理的剩余表(" & failedCount & "个).xlsx"
    objWorkbook.SaveCopyAs leftoverPath
    objWorkbook.Close False
    
    WScript.Echo "SUCCESS: Created leftover file -> " & fso.GetFileName(leftoverPath)
    
    ' 视为整体成功（因为我们要的结果都拿到了，剩下的也打包了）
    QuitScript 0
Else
    QuitScript 0
End If


' =========================================================
' 辅助过程
' =========================================================
Sub SetupExcelApp(app)
    app.Visible = False
    app.DisplayAlerts = False ' 关键：删除Sheet时不弹窗
    app.ScreenUpdating = False
    app.EnableEvents = False
End Sub

Sub ForceRestartExcel()
    On Error Resume Next
    If Not objWorkbook Is Nothing Then objWorkbook.Close False
    If Not objExcel Is Nothing Then objExcel.Quit
    Set objWorkbook = Nothing
    Set objExcel = Nothing
    WScript.Sleep 1000
    Set objExcel = CreateObject("Excel.Application")
    SetupExcelApp objExcel
    Set objWorkbook = objExcel.Workbooks.Open(sourcePath, False, True, , , , True)
    objWorkbook.Unprotect
End Sub

Sub QuitScript(code)
    On Error Resume Next
    If Not objWorkbook Is Nothing Then objWorkbook.Close False
    If Not objExcel Is Nothing Then objExcel.Quit
    WScript.Echo "INFO: Process Finished."
    WScript.Quit code
End Sub

Function CleanFileName(ByName)
    Dim s
    s = ByName
    s = Replace(s, "/", "_")
    s = Replace(s, "\", "_")
    s = Replace(s, ":", "_")
    s = Replace(s, "*", "_")
    s = Replace(s, "?", "_")
    s = Replace(s, """", "_")
    s = Replace(s, "<", "_")
    s = Replace(s, ">", "_")
    s = Replace(s, "|", "_")
    s = Replace(s, vbCr, "")
    s = Replace(s, vbLf, "")
    CleanFileName = s
End Function

Function GetUniquePath(Dir, Name)
    Dim fso, path, count
    Set fso = CreateObject("Scripting.FileSystemObject")
    path = Dir & "\" & Name & ".xlsx"
    count = 1
    Do While fso.FileExists(path)
        path = Dir & "\" & Name & "_" & count & ".xlsx"
        count = count + 1
    Loop
    GetUniquePath = path
End Function