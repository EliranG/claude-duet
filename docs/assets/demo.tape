# claude-duet demo
Output docs/assets/demo.gif
Set Shell "bash"
Set FontSize 18
Set Width 900
Set Height 450
Set Theme { "name": "claude-duet", "black": "#0a0a1a", "red": "#ff5f57", "green": "#28c840", "yellow": "#febc2e", "blue": "#7c3aed", "magenta": "#a78bfa", "cyan": "#22d3ee", "white": "#e2e8f0", "brightBlack": "#555577", "brightRed": "#ff5f57", "brightGreen": "#28c840", "brightYellow": "#febc2e", "brightBlue": "#a78bfa", "brightMagenta": "#c4b5fd", "brightCyan": "#67e8f9", "brightWhite": "#ffffff", "background": "#0a0a1a", "foreground": "#e2e8f0", "selectionBackground": "#7c3aed", "cursorColor": "#a78bfa" }
Set Padding 24
Set Framerate 20
Set TypingSpeed 40ms

# Host starts
Type "npx claude-duet host --name eliran"
Sleep 400ms
Enter
Sleep 1.5s

# Session output
Hide
Type "echo ''"
Enter
Type "echo '  ✦ claude-duet session started'"
Enter
Type "echo '  Code: cd-7f3a · Password: ocean-breeze'"
Enter
Type "echo ''"
Enter
Type "echo '  npx claude-duet join cd-7f3a --password ocean-breeze --url ws://192.168.1.5:4567'"
Enter
Type "echo ''"
Enter
Show
Sleep 2.5s

# Bob joins
Hide
Type "echo '  ✦ benji joined the session!'"
Enter
Show
Sleep 1.5s

# Bob sends prompt
Hide
Type "echo ''"
Enter
Type "echo '  benji > fix the auth bug'"
Enter
Show
Sleep 1.5s

# Claude responds
Hide
Type "echo '  claude ✦ Fixed! Added token expiry check to auth.ts'"
Enter
Type "echo '  ✓ Turn complete · \$0.003 · 1.2s'"
Enter
Show
Sleep 3s
