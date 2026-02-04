tell application "Visual Studio Code - Insiders" to activate

tell application "System Events"
  delay 0.3
  keystroke "p" using {command down, shift down}
  delay 0.3
  keystroke "Reload Window"
  delay 0.3
  key code 36
end tell
