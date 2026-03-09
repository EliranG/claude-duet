# claude-duet demo
Output docs/assets/demo.gif
Set Shell "bash"
Set FontSize 18
Set Width 900
Set Height 480
Set Theme { "name": "claude-duet", "black": "#0a0a1a", "red": "#ff5f57", "green": "#28c840", "yellow": "#febc2e", "blue": "#7c3aed", "magenta": "#a78bfa", "cyan": "#22d3ee", "white": "#e2e8f0", "brightBlack": "#555577", "brightRed": "#ff5f57", "brightGreen": "#28c840", "brightYellow": "#febc2e", "brightBlue": "#a78bfa", "brightMagenta": "#c4b5fd", "brightCyan": "#67e8f9", "brightWhite": "#ffffff", "background": "#0a0a1a", "foreground": "#e2e8f0", "selectionBackground": "#7c3aed", "cursorColor": "#a78bfa" }
Set Padding 24
Set Framerate 20
Set TypingSpeed 50ms

# Set up: hide prompt, alias npx to sim script
Hide
Type "export PS1='> '"
Enter
Type "npx() { bash docs/assets/demo-sim.sh; }"
Enter
Type "clear"
Enter
Sleep 300ms
Show

# User types the command — looks real
Type "npx claude-duet host --name eliran"
Sleep 300ms
Enter

# Sim script runs visibly, sleeps handle pacing
Sleep 20s
