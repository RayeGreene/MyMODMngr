!macro NSIS_HOOK_PREINSTALL
  ; Force close the backend process to prevent file locking issues
  ; nsExec::Exec runs the command without a console window
  nsExec::Exec 'taskkill /F /IM rivalnxt_backend.exe'
  
  ; Delete the old local files irrespective of installation options
  RMDir /r "$APPDATA\com.rivalnxt.modmanager"
  RMDir /r "$LOCALAPPDATA\com.rivalnxt.modmanager"
!macroend
