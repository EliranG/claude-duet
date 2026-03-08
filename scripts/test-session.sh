#!/bin/bash
#
# test-session.sh — Launch a claude-duet host + guest in two Terminal.app windows
# with a scripted demo conversation using custom nicknames.
#
# Usage: ./scripts/test-session.sh
#
# Opens two terminal windows side-by-side:
#   Left:  claude-duet host ("Eliran")
#   Right: claude-duet guest ("Benji")
#
# After both connect, a scripted demo conversation plays out automatically:
#   Eliran: "Hey Benji! Let's fix that login bug together"
#   Benji:   "Sure! Can you check what's in src/auth.ts?"
#   Eliran: "Let me ask Claude to help us debug it"
#   Benji:   "Nice, the session is working great!"
#
# Press Ctrl+C in either window to end.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SESSION_DIR="$REPO_DIR/.test-session"

# Clean previous session
rm -rf "$SESSION_DIR"
mkdir -p "$SESSION_DIR"

# Build first
echo "Building claude-duet..."
cd "$REPO_DIR"
npm run build --silent 2>&1

echo "Preparing test session..."

# Create input files for scripted messages (tail -f watches these)
touch "$SESSION_DIR/host-input.txt"
touch "$SESSION_DIR/guest-input.txt"

# --- Host script ---
# Uses `tail -f` on an input file so the orchestrator can append lines
# that appear as if Eliran typed them. The tail output is piped into
# the node process's stdin. Output goes to both the terminal and a log
# file via `tee` (avoids the raw input echo that `script` causes).
cat > "$SESSION_DIR/run-host.sh" <<'HOSTEOF'
#!/bin/bash
REPO_DIR="__REPO_DIR__"
SESSION_DIR="__SESSION_DIR__"

cd "$REPO_DIR"
echo ""
echo "  ┌─────────────────────────────────┐"
echo "  │  HOST TERMINAL  —  Eliran        │"
echo "  │  Type your prompts below        │"
echo "  │  Press Ctrl+C to end session    │"
echo "  └─────────────────────────────────┘"
echo ""

# tail -f watches the input file for new lines appended by the orchestrator.
# Output is tee'd to both the terminal and a log file so the guest script
# can discover the join command. Unlike `script`, `tee` does not echo stdin.
tail -f "$SESSION_DIR/host-input.txt" | node dist/index.js host --name Eliran -p 0 2>&1 | tee "$SESSION_DIR/host-output.log"
HOSTEOF

# Substitute paths (can't use shell vars inside single-quoted heredoc)
sed -i '' "s|__REPO_DIR__|$REPO_DIR|g" "$SESSION_DIR/run-host.sh"
sed -i '' "s|__SESSION_DIR__|$SESSION_DIR|g" "$SESSION_DIR/run-host.sh"
chmod +x "$SESSION_DIR/run-host.sh"

# --- Guest script ---
cat > "$SESSION_DIR/run-guest.sh" <<'GUESTEOF'
#!/bin/bash
REPO_DIR="__REPO_DIR__"
SESSION_DIR="__SESSION_DIR__"

cd "$REPO_DIR"
echo ""
echo "  ┌─────────────────────────────────┐"
echo "  │  GUEST TERMINAL  —  Benji         │"
echo "  │  Waiting for host to start...   │"
echo "  │  Press Ctrl+C to leave session  │"
echo "  └─────────────────────────────────┘"
echo ""

# Poll for the join command in host output
TRIES=0
JOIN_LINE=""
while [ -z "$JOIN_LINE" ]; do
  TRIES=$((TRIES + 1))
  if [ $TRIES -gt 60 ]; then
    echo "  Timed out waiting for host (30s). Is the host terminal running?"
    exit 1
  fi
  sleep 0.5
  if [ -f "$SESSION_DIR/host-output.log" ]; then
    # Strip all ANSI escape sequences (including bracketed paste mode, cursor codes)
    # and carriage returns that macOS `script` / terminal emulators inject.
    JOIN_LINE=$(sed 's/\x1b\[[0-9;]*[a-zA-Z]//g; s/\x1b\[[?][0-9;]*[a-zA-Z]//g; s/\r//g' "$SESSION_DIR/host-output.log" 2>/dev/null | grep -o 'npx claude-duet join [^ ]* --password [^ ]* --url [^ ]*' | head -1 || true)
  fi
done

echo "  Found join command!"
echo "  $JOIN_LINE"
echo ""

# Replace 'npx claude-duet' with local node for dev testing
LOCAL_CMD=$(echo "$JOIN_LINE" | sed "s|npx claude-duet|node dist/index.js|")
LOCAL_CMD="$LOCAL_CMD --name Benji"

echo "  Running: $LOCAL_CMD"
echo ""

# tail -f watches the input file for new lines appended by the orchestrator.
# Output goes to both terminal and log via tee (no raw echo from `script`).
tail -f "$SESSION_DIR/guest-input.txt" | eval "$LOCAL_CMD" 2>&1 | tee "$SESSION_DIR/guest-output.log"
GUESTEOF

sed -i '' "s|__REPO_DIR__|$REPO_DIR|g" "$SESSION_DIR/run-guest.sh"
sed -i '' "s|__SESSION_DIR__|$SESSION_DIR|g" "$SESSION_DIR/run-guest.sh"
chmod +x "$SESSION_DIR/run-guest.sh"

# --- Orchestrator script ---
# Runs in the background from the main script's terminal. Watches the
# host output log for signs that both sides are connected, then feeds
# scripted messages by appending lines to the input files. The `tail -f`
# processes in each terminal window pick them up in real-time.
cat > "$SESSION_DIR/run-orchestrator.sh" <<'ORCHEOF'
#!/bin/bash
SESSION_DIR="__SESSION_DIR__"

# Wait for the host to be listening (join command visible in output)
echo "[orchestrator] Waiting for host to start..."
TRIES=0
while true; do
  TRIES=$((TRIES + 1))
  if [ $TRIES -gt 120 ]; then
    echo "[orchestrator] Timed out waiting for host."
    exit 1
  fi
  sleep 0.5
  if [ -f "$SESSION_DIR/host-output.log" ]; then
    if sed 's/\x1b\[[0-9;]*[a-zA-Z]//g; s/\x1b\[[?][0-9;]*[a-zA-Z]//g; s/\r//g' "$SESSION_DIR/host-output.log" 2>/dev/null | grep -q "npx claude-duet join"; then
      echo "[orchestrator] Host is ready."
      break
    fi
  fi
done

# Wait for the guest to connect (host output shows "joined the session")
echo "[orchestrator] Waiting for guest to connect..."
TRIES=0
while true; do
  TRIES=$((TRIES + 1))
  if [ $TRIES -gt 120 ]; then
    echo "[orchestrator] Timed out waiting for guest to join."
    exit 1
  fi
  sleep 0.5
  if sed 's/\x1b\[[0-9;]*[a-zA-Z]//g; s/\x1b\[[?][0-9;]*[a-zA-Z]//g; s/\r//g' "$SESSION_DIR/host-output.log" 2>/dev/null | grep -q "joined the session"; then
    echo "[orchestrator] Guest connected! Starting demo scenario..."
    break
  fi
done

# Give the UI a moment to settle after connection
sleep 2

# --- Scripted demo conversation ---
# Each message is sent by appending a line to the appropriate input file.
# The `tail -f` in each terminal picks it up and feeds it to the node
# process's readline, which treats it as user-typed input.

echo "[orchestrator] Eliran: sending message 1..."
echo "Hey Benji! Let's fix that login bug together" >> "$SESSION_DIR/host-input.txt"
sleep 2

echo "[orchestrator] Benji: sending message 1..."
echo "Sure! Can you check what's in src/auth.ts?" >> "$SESSION_DIR/guest-input.txt"
sleep 2

echo "[orchestrator] Eliran: sending message 2..."
echo "Let me ask Claude to help us debug it" >> "$SESSION_DIR/host-input.txt"
sleep 3

echo "[orchestrator] Benji: sending message 2..."
echo "Nice, the session is working great!" >> "$SESSION_DIR/guest-input.txt"

echo ""
echo "[orchestrator] Demo scenario complete!"
echo "[orchestrator] You can now type freely in either window."
echo "[orchestrator] Press Ctrl+C in either window to end the session."

# Check for unexpected errors in host output (ignore SDK-related ones)
if [ -f "$SESSION_DIR/host-output.log" ]; then
  ERRORS=$(sed 's/\x1b\[[0-9;]*[a-zA-Z]//g; s/\x1b\[[?][0-9;]*[a-zA-Z]//g; s/\r//g' "$SESSION_DIR/host-output.log" | grep "Error:" | grep -v "claude-agent-sdk" | head -5 || true)
  if [ -n "$ERRORS" ]; then
    echo ""
    echo "[orchestrator] WARNING: Errors detected in host output:"
    echo "$ERRORS"
  fi
fi

# Check for unexpected errors in guest output
if [ -f "$SESSION_DIR/guest-output.log" ]; then
  ERRORS=$(sed 's/\x1b\[[0-9;]*[a-zA-Z]//g; s/\x1b\[[?][0-9;]*[a-zA-Z]//g; s/\r//g' "$SESSION_DIR/guest-output.log" | grep "Error:" | grep -v "claude-agent-sdk" | head -5 || true)
  if [ -n "$ERRORS" ]; then
    echo ""
    echo "[orchestrator] WARNING: Errors detected in guest output:"
    echo "$ERRORS"
  fi
fi
ORCHEOF

sed -i '' "s|__SESSION_DIR__|$SESSION_DIR|g" "$SESSION_DIR/run-orchestrator.sh"
chmod +x "$SESSION_DIR/run-orchestrator.sh"

# --- Open two Terminal.app windows side-by-side ---
echo "Opening two Terminal windows..."

# Get screen width for positioning
SCREEN_WIDTH=$(osascript -e 'tell application "Finder" to get bounds of window of desktop' 2>/dev/null | awk -F', ' '{print $3}' || echo "1440")
HALF=$((SCREEN_WIDTH / 2))

# Open host terminal (left half)
osascript -e "
tell application \"Terminal\"
  activate
  do script \"$SESSION_DIR/run-host.sh\"
  set bounds of front window to {0, 0, $HALF, 900}
end tell
"

sleep 1

# Open guest terminal (right half)
osascript -e "
tell application \"Terminal\"
  do script \"$SESSION_DIR/run-guest.sh\"
  set bounds of front window to {$HALF, 0, $((HALF * 2)), 900}
end tell
"

echo ""
echo "Two Terminal.app windows opened:"
echo "  LEFT  = Host (Eliran)"
echo "  RIGHT = Guest (Benji)"
echo ""
echo "Starting demo orchestrator in the background..."
echo ""

# Run the orchestrator in the background from this terminal
bash "$SESSION_DIR/run-orchestrator.sh" &
ORCHESTRATOR_PID=$!

echo "Orchestrator PID: $ORCHESTRATOR_PID"
echo ""
echo "The scripted demo will play automatically once both sides connect."
echo "After the demo, type freely in either window."
echo "Press Ctrl+C in either window to end the session."
echo ""
echo "To clean up: rm -rf $SESSION_DIR"

# Wait for the orchestrator to finish (or user Ctrl+C)
wait $ORCHESTRATOR_PID 2>/dev/null || true
