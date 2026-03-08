# Terminal Visual Indicators & Customizations: Comprehensive Technical Reference

Research compiled for pair-vibing CLI tool. Covers every technique a CLI can use to create a distinctive "active session" feel in a terminal.

---

## Table of Contents

1. [Terminal Cursor Customization](#1-terminal-cursor-customization)
2. [Terminal Title Bar](#2-terminal-title-bar)
3. [Terminal Tab Customization](#3-terminal-tab-customization)
4. [Unicode/Emoji Indicators](#4-unicodeemoji-indicators)
5. [ANSI Color/Style Tricks](#5-ansi-colorstyle-tricks)
6. [Terminal-Specific Features](#6-terminal-specific-features)
7. [Shell Integration Indicators](#7-shell-integration-indicators)
8. [Sound/Haptic Feedback](#8-soundhaptic-feedback)
9. [Desktop Notifications](#9-desktop-notifications)
10. [Persistent Status Bar](#10-persistent-status-bar)
11. [Terminal Detection](#11-terminal-detection)
12. [Cleanup & State Restoration](#12-cleanup--state-restoration)

---

## 1. Terminal Cursor Customization

### Cursor Shape (DECSCUSR)

You can change the cursor shape using the **DECSCUSR** (Set Cursor Style) escape sequence.

**Escape sequence format:** `\x1b[{Ps} q` (CSI Ps SP q)

| Ps Value | Style               |
|----------|---------------------|
| 0        | Blinking block (default) |
| 1        | Blinking block       |
| 2        | Steady block         |
| 3        | Blinking underline   |
| 4        | Steady underline     |
| 5        | Blinking bar (xterm extension) |
| 6        | Steady bar (xterm extension)   |

**Terminal support:**

| Terminal         | Supported? |
|------------------|-----------|
| iTerm2           | Yes       |
| Kitty            | Yes       |
| WezTerm          | Yes       |
| Ghostty          | Yes       |
| macOS Terminal   | Yes       |
| Windows Terminal | Yes       |
| xterm            | Yes       |
| Alacritty        | Yes       |
| gnome-terminal   | Yes       |
| VS Code terminal | Yes (via xterm.js) |

**Node.js example:**
```typescript
// Set cursor to blinking bar
process.stdout.write('\x1b[5 q');

// Set cursor to steady block
process.stdout.write('\x1b[2 q');

// Restore to default (blinking block)
process.stdout.write('\x1b[0 q');
```

**Auto-reverts on exit:** NO. You must manually restore. Use `\x1b[0 q` to reset to default.

### Cursor Color (OSC 12)

You can change the cursor color using OSC 12.

**Escape sequence format:** `\x1b]12;{color}\x07` or `\x1b]12;{color}\x1b\\`

Where `{color}` can be:
- A named X11 color: `red`, `green`, `blue`, `orange`
- An RGB hex color: `#ff6600`, `rgb:ff/66/00`

**Terminal support:**

| Terminal         | OSC 12 Support? | Alternative?                     |
|------------------|----------------|----------------------------------|
| iTerm2           | NO             | Use `OSC 1337;SetColors=curbg={hex}` |
| Kitty            | Yes            |                                  |
| WezTerm          | Yes            |                                  |
| Ghostty          | Yes            |                                  |
| macOS Terminal   | NO             | No alternative                   |
| Windows Terminal | Partial        |                                  |
| xterm            | Yes            |                                  |

**Node.js example:**
```typescript
// Set cursor color to orange
process.stdout.write('\x1b]12;#ff6600\x07');

// Query current cursor color (response comes via stdin)
process.stdout.write('\x1b]12;?\x07');

// Reset cursor color to default
process.stdout.write('\x1b]112\x07');
```

**Auto-reverts on exit:** NO. Use `\x1b]112\x07` (OSC 112) to reset.

### Cursor Visibility

```typescript
// Hide cursor
process.stdout.write('\x1b[?25l');

// Show cursor
process.stdout.write('\x1b[?25h');
```

**Support:** Universal across all modern terminals.

**Auto-reverts on exit:** Most terminals auto-restore cursor visibility, but not guaranteed. Always restore explicitly.

### Cursor Blink Rate

There is no standard escape sequence to control blink rate. Blink vs. steady is controlled by the DECSCUSR odd/even values (odd = blink, even = steady).

---

## 2. Terminal Title Bar

### Setting the Window Title (OSC 0 / OSC 2)

**Escape sequences:**
- `\x1b]0;{title}\x07` -- Sets both icon name and window title
- `\x1b]2;{title}\x07` -- Sets window title only
- `\x1b]1;{title}\x07` -- Sets icon name / tab title only

**Node.js example:**
```typescript
// Set window title
function setTerminalTitle(title: string): void {
  process.stdout.write(`\x1b]0;${title}\x07`);
}

// Dynamic title with session info
setTerminalTitle('pair-vibe \u25cf alice + bob');

// Clear/restore title (set to empty)
process.stdout.write('\x1b]0;\x07');
```

**Terminal support:**

| Terminal         | OSC 0 | OSC 2 | Notes |
|------------------|-------|-------|-------|
| iTerm2           | Yes   | Yes   |       |
| Kitty            | Yes   | Yes   |       |
| WezTerm          | Yes   | Yes   |       |
| Ghostty          | Yes   | Yes   |       |
| macOS Terminal   | Yes   | Yes   |       |
| Windows Terminal | Yes   | Yes   |       |
| xterm            | Yes   | Yes   |       |

### tmux/screen Compatibility

In tmux, the title is set on the tmux *window*, not the outer terminal. tmux uses different sequences:

```typescript
// tmux window name
process.stdout.write('\x1bkWINDOW_NAME\x1b\\');

// For OSC to pass through tmux to the outer terminal:
// Wrap in DCS passthrough
process.stdout.write('\x1bPtmux;\x1b\x1b]0;title\x07\x1b\\');
```

For tmux, you may also need `set -g set-titles on` and `set -g set-titles-string "#{pane_title}"` in tmux.conf.

**Auto-reverts on exit:** NO. The title persists after the process exits. You must save and restore it yourself (no standard way to query the current title across all terminals).

---

## 3. Terminal Tab Customization

### Tab Title (OSC 1)

```typescript
// Set tab title (distinct from window title in some terminals)
process.stdout.write('\x1b]1;pair-vibe session\x07');
```

Works in iTerm2, WezTerm, and some others. In many terminals, OSC 0 sets both.

### Tab Color (iTerm2 Only)

iTerm2 supports changing the tab color via proprietary escape sequences:

**Escape sequence format:** `\x1b]6;1;bg;{component};brightness;{value}\x07`

Where `{component}` is `red`, `green`, or `blue`, and `{value}` is 0-255.

```typescript
function setTabColor(r: number, g: number, b: number): void {
  process.stdout.write(`\x1b]6;1;bg;red;brightness;${r}\x07`);
  process.stdout.write(`\x1b]6;1;bg;green;brightness;${g}\x07`);
  process.stdout.write(`\x1b]6;1;bg;blue;brightness;${b}\x07`);
}

function resetTabColor(): void {
  // Reset tab color to default
  process.stdout.write('\x1b]6;1;bg;*;default\x07');
}

// Set tab to a warm orange for active session
setTabColor(255, 140, 50);
```

**Support:** iTerm2 only. No equivalent in other terminals.

**Auto-reverts on exit:** NO. Must call resetTabColor() on cleanup.

---

## 4. Unicode/Emoji Indicators

### Effective Session Indicator Symbols

These are widely supported Unicode characters that render well in monospace terminal fonts:

**Geometric/Status:**
- `\u25cf` (●) -- filled circle, great for "active" indicator
- `\u25cb` (○) -- empty circle, "inactive"
- `\u25a0` (■) -- filled square
- `\u25b6` (▶) -- play triangle
- `\u2022` (•) -- bullet

**Stars/Sparkles:**
- `\u2726` (✦) -- four-pointed star (Claude Code uses this style with orange color)
- `\u2727` (✧) -- open four-pointed star
- `\u2731` (✱) -- heavy asterisk
- `\u273b` (✻) -- teardrop-spoked asterisk (used by Claude Code with ANSI 256 color 174)
- `\u2605` (★) -- black star

**Connection/Pair indicators:**
- `\u26a1` (⚡) -- lightning bolt
- `\u2194` (↔) -- bidirectional arrow
- `\u21c4` (⇄) -- right-left arrows
- `\u2248` (≈) -- approximately equal (similarity)
- `\u2261` (≡) -- identical to

**People/Social (emoji - require emoji font support):**
- `\ud83d\udc65` (👥) -- silhouettes
- `\ud83d\udd17` (🔗) -- link

**Caution with emoji:** Emoji are double-width characters in most terminals and may cause alignment issues. Stick to Unicode symbols from the BMP (Basic Multilingual Plane) for maximum compatibility.

### How Claude Code Renders Its Colored Star

Claude Code uses ANSI 256-color mode to color a Unicode asterisk/star character:

```typescript
// Claude Code's approach: teardrop-spoked asterisk in orange (color 174)
const orangeStar = '\x1b[38;5;174m\u273b\x1b[39m';
// Or with truecolor:
const orangeStarTC = '\x1b[38;2;255;140;80m\u2726\x1b[39m';
```

### Nerd Font Icons

If users have Nerd Fonts installed, you get access to 3600+ icons. Popular ones for a pairing tool:

```
\uf0c0  (group/team icon)
\uf007  (user icon)
\uf0e8  (sitemap/connection)
\uf1e0  (share icon)
\ue727  (terminal icon)
\uf489  (terminal icon alt)
\uf817  (pair of people)
```

**Important:** Never *require* Nerd Fonts. Always have a Unicode/ASCII fallback:

```typescript
const hasNerdFont = detectNerdFont(); // user config or heuristic
const icon = hasNerdFont ? '\uf0c0' : '\u25cf';
```

### Spinner Characters (Animated Unicode)

The `cli-spinners` library provides 70+ spinner animations. Key ones:

**Braille dots (most popular, very smooth):**
```typescript
const dots = {
  interval: 80,
  frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
};
```

**Line spinner (ASCII fallback for Windows):**
```typescript
const line = {
  interval: 130,
  frames: ['-', '\\', '|', '/']
};
```

**Circle dots:**
```typescript
const circle = {
  interval: 120,
  frames: ['◐', '◓', '◑', '◒']
};
```

**Growing dots:**
```typescript
const growDots = {
  interval: 120,
  frames: ['⣀', '⣄', '⣤', '⣦', '⣶', '⣷', '⣿', '⡿', '⠿', '⠛', '⠋', '⠁']
};
```

For implementation, use the `ora` package or implement directly:

```typescript
import { createSpinner } from './spinner';

class TerminalSpinner {
  private frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  private interval = 80;
  private current = 0;
  private timer: NodeJS.Timeout | null = null;

  start(message: string) {
    process.stdout.write('\x1b[?25l'); // hide cursor
    this.timer = setInterval(() => {
      const frame = this.frames[this.current % this.frames.length];
      process.stdout.write(`\r${frame} ${message}`);
      this.current++;
    }, this.interval);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    process.stdout.write('\r\x1b[K'); // clear line
    process.stdout.write('\x1b[?25h'); // show cursor
  }
}
```

---

## 5. ANSI Color/Style Tricks

### Text Styling

| Style        | Enable       | Disable      | Useful for          |
|-------------|-------------|-------------|---------------------|
| Bold        | `\x1b[1m`  | `\x1b[22m` | Usernames, emphasis |
| Dim/Faint   | `\x1b[2m`  | `\x1b[22m` | Secondary info      |
| Italic      | `\x1b[3m`  | `\x1b[23m` | Status messages     |
| Underline   | `\x1b[4m`  | `\x1b[24m` | Links, actions      |
| Blink       | `\x1b[5m`  | `\x1b[25m` | Alerts (use sparingly!) |
| Reverse     | `\x1b[7m`  | `\x1b[27m` | Selection, status bar |
| Hidden      | `\x1b[8m`  | `\x1b[28m` | Sensitive data      |
| Strikethrough | `\x1b[9m` | `\x1b[29m` | Cancelled items     |
| Reset all   | `\x1b[0m`  |            |                     |

### Styled Underlines (Kitty Extension, Adopted by Many)

```typescript
// Underline styles (Kitty extension, supported by WezTerm, VTE, mintty)
'\x1b[4:1m'  // straight underline
'\x1b[4:2m'  // double underline
'\x1b[4:3m'  // curly underline (wavy, great for "active" indicator)
'\x1b[4:4m'  // dotted underline
'\x1b[4:5m'  // dashed underline

// Set underline color (separate from text color!)
'\x1b[58;2;255;140;50m'  // underline color to orange (truecolor)
'\x1b[58;5;174m'         // underline color to orange (256-color)
'\x1b[59m'               // reset underline color
'\x1b[4:0m'              // disable underline
```

### Color Modes

**16 colors (universal):**
```typescript
// Foreground: 30-37 (standard), 90-97 (bright)
// Background: 40-47 (standard), 100-107 (bright)
'\x1b[31m'   // red foreground
'\x1b[42m'   // green background
'\x1b[91m'   // bright red foreground
'\x1b[39m'   // default foreground
'\x1b[49m'   // default background
```

**256 colors:**
```typescript
// Foreground: \x1b[38;5;{n}m  where n = 0-255
// Background: \x1b[48;5;{n}m
'\x1b[38;5;174m'  // orange-ish (Claude Code's star color)
'\x1b[38;5;214m'  // brighter orange
'\x1b[48;5;236m'  // dark gray background
```

**Truecolor (24-bit RGB):**
```typescript
// Foreground: \x1b[38;2;{r};{g};{b}m
// Background: \x1b[48;2;{r};{g};{b}m
'\x1b[38;2;255;140;50m'   // orange text
'\x1b[48;2;30;30;40m'     // dark background
```

### Color Support Detection

```typescript
function detectColorSupport(): 'none' | '16' | '256' | 'truecolor' {
  // Check NO_COLOR standard (https://no-color.org)
  if (process.env.NO_COLOR !== undefined) return 'none';

  // Check FORCE_COLOR
  if (process.env.FORCE_COLOR === '3') return 'truecolor';
  if (process.env.FORCE_COLOR === '2') return '256';
  if (process.env.FORCE_COLOR === '1') return '16';
  if (process.env.FORCE_COLOR === '0') return 'none';

  // Check COLORTERM for truecolor
  const colorterm = process.env.COLORTERM;
  if (colorterm === 'truecolor' || colorterm === '24bit') return 'truecolor';

  // Check TERM_PROGRAM
  const termProgram = process.env.TERM_PROGRAM;
  if (termProgram === 'iTerm.app') return 'truecolor';
  if (termProgram === 'WezTerm') return 'truecolor';
  if (termProgram === 'Apple_Terminal') return '256';

  // Check TERM
  const term = process.env.TERM || '';
  if (term === 'xterm-kitty') return 'truecolor';
  if (term === 'xterm-ghostty') return 'truecolor';
  if (term.endsWith('-256color')) return '256';

  // Fallback
  if (process.stdout.hasColors?.(16777216)) return 'truecolor';
  if (process.stdout.hasColors?.(256)) return '256';
  if (process.stdout.hasColors?.()) return '16';

  return 'none';
}
```

### Simulating a "Border" or "Region Highlight"

There is no ANSI escape sequence to draw an actual border around the terminal viewport. However, you can simulate visual framing:

**Reverse video status bar:**
```typescript
// Full-width reverse-video line as a "banner"
const cols = process.stdout.columns || 80;
const text = ' pair-vibe \u25cf alice + bob ';
const padding = ' '.repeat(Math.max(0, cols - text.length));
process.stdout.write(`\x1b[7m${text}${padding}\x1b[27m\n`);
```

**Background color region:**
```typescript
// Set background for a full line
const cols = process.stdout.columns || 80;
process.stdout.write(`\x1b[48;2;40;40;60m${' '.repeat(cols)}\x1b[49m\n`);
```

**Box drawing characters:**
```typescript
// Unicode box drawing for framed regions
const top    = '\u250c' + '\u2500'.repeat(40) + '\u2510';
const middle = '\u2502' + ' pair-vibe session active '.padEnd(40) + '\u2502';
const bottom = '\u2514' + '\u2500'.repeat(40) + '\u2518';
console.log(top);
console.log(middle);
console.log(bottom);
```

---

## 6. Terminal-Specific Features

### iTerm2 (macOS)

iTerm2 has the richest set of proprietary features via OSC 1337:

**Badge (large translucent overlay text):**
```typescript
// Set badge text (appears as watermark in top-right of terminal)
function setBadge(text: string): void {
  const encoded = Buffer.from(text).toString('base64');
  process.stdout.write(`\x1b]1337;SetBadgeFormat=${encoded}\x07`);
}
setBadge('pair-vibe');

// Clear badge
setBadge('');
```

**Notifications:**
```typescript
// Desktop notification (iTerm2)
process.stdout.write(`\x1b]9;Partner joined the session\x07`);
```

**Progress bar (shows in title bar/dock icon):**
```typescript
// State: 0=remove, 1=normal, 2=error, 3=indeterminate, 4=pause
function setProgress(state: number, percent?: number): void {
  const value = percent !== undefined ? `;${percent}` : '';
  process.stdout.write(`\x1b]9;4;${state}${value}\x07`);
}
setProgress(1, 50);  // 50% progress
setProgress(3);       // indeterminate spinner
setProgress(0);       // clear
```

**Marks (bookmarks in scrollback):**
```typescript
process.stdout.write('\x1b]1337;SetMark\x07');
```

**Cursor shape (iTerm2 proprietary, alternative to DECSCUSR):**
```typescript
// 0=block, 1=bar, 2=underline
process.stdout.write('\x1b]1337;CursorShape=1\x07');
```

**Cursor guide line (horizontal line at cursor):**
```typescript
process.stdout.write('\x1b]1337;HighlightCursorLine=true\x07');
// Disable:
process.stdout.write('\x1b]1337;HighlightCursorLine=false\x07');
```

**Color palette changes:**
```typescript
// Change specific colors
process.stdout.write('\x1b]1337;SetColors=bg=1a1a2e\x07');  // dark background
process.stdout.write('\x1b]1337;SetColors=fg=e0e0e0\x07');  // light foreground
```

**Profile switching:**
```typescript
// Switch to a named profile (must exist in iTerm2 settings)
process.stdout.write('\x1b]1337;SetProfile=PairVibe\x07');
```

**Steal focus / request attention:**
```typescript
process.stdout.write('\x1b]1337;RequestAttention=yes\x07');
// Options: yes, once, no, fireworks
```

**Background image:**
```typescript
const imgData = fs.readFileSync('bg.png').toString('base64');
process.stdout.write(`\x1b]1337;SetBackgroundImageFile=${imgData}\x07`);
```

**Inline images:**
```typescript
function displayImage(data: Buffer, opts: { width?: string; height?: string } = {}): void {
  const b64 = data.toString('base64');
  const params = [
    `size=${data.length}`,
    `inline=1`,
    opts.width ? `width=${opts.width}` : '',
    opts.height ? `height=${opts.height}` : '',
  ].filter(Boolean).join(';');
  process.stdout.write(`\x1b]1337;File=${params}:${b64}\x07`);
}
```

**Touch Bar customization:**
```typescript
process.stdout.write('\x1b]1337;SetKeyLabel=F1=Pair Mode\x07');
```

**User variables (for shell integration):**
```typescript
const value = Buffer.from('active').toString('base64');
process.stdout.write(`\x1b]1337;SetUserVar=pairvibe_status=${value}\x07`);
```

**Hyperlinks (OSC 8, cross-terminal):**
```typescript
function hyperlink(url: string, text: string): string {
  return `\x1b]8;;${url}\x1b\\${text}\x1b]8;;\x1b\\`;
}
```

**Shell integration (FinalTerm protocol):**
```typescript
// Prompt start
process.stdout.write('\x1b]133;A\x07');
// Command start
process.stdout.write('\x1b]133;B\x07');
// Command executed
process.stdout.write('\x1b]133;C\x07');
// Command finished (with exit status)
process.stdout.write('\x1b]133;D;0\x07');
```

### Kitty

**Desktop notifications (OSC 99):**
```typescript
function kittyNotify(title: string, body?: string, id?: string): void {
  const notifId = id || `pv-${Date.now()}`;
  if (body) {
    // Multi-part: title first, then body
    process.stdout.write(`\x1b]99;i=${notifId}:d=0;${title}\x1b\\`);
    process.stdout.write(`\x1b]99;i=${notifId}:p=body;${body}\x1b\\`);
  } else {
    process.stdout.write(`\x1b]99;;${title}\x1b\\`);
  }
}
kittyNotify('Pair Vibe', 'Alice just joined the session');
```

**Image display (Kitty graphics protocol):**
```typescript
// Kitty graphics protocol uses APC sequences
// Basic inline image:
function kittyImage(data: Buffer): void {
  const b64 = data.toString('base64');
  // Chunked transfer for large images
  const chunkSize = 4096;
  for (let i = 0; i < b64.length; i += chunkSize) {
    const chunk = b64.substring(i, i + chunkSize);
    const isLast = (i + chunkSize >= b64.length);
    const m = isLast ? 0 : 1;
    if (i === 0) {
      process.stdout.write(`\x1b_Ga=T,f=100,m=${m};${chunk}\x1b\\`);
    } else {
      process.stdout.write(`\x1b_Gm=${m};${chunk}\x1b\\`);
    }
  }
}
```

**Colored/styled underlines:**
```typescript
// Already covered in section 5, but this is a Kitty extension
// Curly underline in custom color:
process.stdout.write('\x1b[4:3m\x1b[58;2;255;100;0mwavy orange underline\x1b[59m\x1b[4:0m');
```

**Color stack (save/restore colors):**
```typescript
// Save current color palette
process.stdout.write('\x1b[#P');  // push colors
// ... modify colors ...
// Restore saved colors
process.stdout.write('\x1b[#Q');  // pop colors
```

**Mouse pointer shapes:**
Kitty supports changing the mouse cursor shape inside the terminal (beam, pointer, etc.).

### WezTerm

**Supports most standard sequences plus:**
- OSC 0/1/2 for titles
- OSC 9 for notifications
- OSC 10/11/12 for foreground/background/cursor colors
- OSC 52 for clipboard access
- OSC 133 for shell integration
- OSC 1337 for iTerm2-compatible images
- Kitty graphics protocol (partial)
- Synchronized rendering (DECSET 2026)
- Sixel graphics
- OSC 9;4 progress bars
- RGBA colors via `\x1b[38:6:r:g:b:a m` (alpha channel!)
- User vars (triggers `user-var-changed` event in Lua config)

**WezTerm user vars (for status in tab bar):**
```typescript
function setWezTermUserVar(key: string, value: string): void {
  const encoded = Buffer.from(value).toString('base64');
  process.stdout.write(`\x1b]1337;SetUserVar=${key}=${encoded}\x07`);
}
setWezTermUserVar('pairvibe_status', 'active');
setWezTermUserVar('pairvibe_partner', 'alice');
```

Users can then reference these in their WezTerm Lua config to customize tab titles/appearance.

### Ghostty

**Supported standard features:**
- Full VT520 compatible escape sequences
- OSC 0/1/2 for titles
- OSC 9 for notifications (`\x1b]9;message\x07`)
- OSC 9;4 for progress bars (native GUI rendering in v1.2.0+)
- OSC 777 for rxvt-style notifications
- Shell integration (OSC 133)
- Hyperlinks (OSC 8)
- DECSCUSR for cursor shape

**Ghostty progress bar (renders as native macOS/GTK widget):**
```typescript
// Same OSC 9;4 sequence, but Ghostty renders it as a beautiful native progress bar
process.stdout.write('\x1b]9;4;1;75\x07');  // 75% progress
process.stdout.write('\x1b]9;4;3\x07');     // indeterminate spinner
```

**Ghostty-specific notes:**
- Uses `xterm-ghostty` as TERM value
- Supports Kitty keyboard protocol
- Configurable via ghostty.conf, not escape sequences
- On Linux, progress bar style can be customized via GTK CSS

### macOS Terminal.app

**Supported:**
- OSC 0/2 for window/tab title
- Basic ANSI colors (256)
- DECSCUSR cursor shapes
- Basic cursor visibility

**NOT supported:**
- OSC 12 cursor color
- OSC 1337 (iTerm2 proprietary)
- Kitty graphics protocol
- Images/sixel
- Tab color changes
- Badges
- Truecolor (only 256 colors!)
- Styled underlines
- OSC 9;4 progress bars

Terminal.app identified by: `TERM_PROGRAM=Apple_Terminal`

### Windows Terminal

**Supported:**
- Full ANSI escape sequences (requires Virtual Terminal Processing)
- Truecolor (24-bit)
- DECSCUSR cursor shapes
- OSC 0/2 for titles
- OSC 9;4 progress bars (shows in taskbar!)
- Hyperlinks (OSC 8)
- Synchronized rendering

**NOT supported:**
- OSC 1337 (iTerm2 proprietary)
- Kitty graphics protocol
- Tab color via escape sequences

Identified by: `WT_SESSION` environment variable being set.

---

## 7. Shell Integration Indicators

### Modifying the User's Prompt (PS1)

A CLI tool generally should NOT modify PS1 directly while running. Instead, there are better approaches:

**Environment variable approach (for post-session prompt modification):**
```typescript
// Set an env var that the user's prompt can check
process.env.PAIRVIBE_ACTIVE = '1';
process.env.PAIRVIBE_PARTNER = 'alice';
```

Users can then add to their .zshrc:
```bash
if [ -n "$PAIRVIBE_ACTIVE" ]; then
  PS1="[pair-vibe: $PAIRVIBE_PARTNER] $PS1"
fi
```

**How starship adds indicators:**

Starship works by replacing PS1 with its own rendered prompt before each command. It reads from `~/.config/starship.toml` for configuration. Custom modules can check for environment variables:

```toml
[custom.pairvibe]
command = 'echo "👥 $PAIRVIBE_PARTNER"'
when = 'test -n "$PAIRVIBE_ACTIVE"'
format = "[$output]($style) "
style = "bold yellow"
```

**Oh My Zsh custom plugin approach:**

Create a file at `~/.oh-my-zsh/custom/plugins/pairvibe/pairvibe.plugin.zsh`:
```bash
pairvibe_prompt_info() {
  if [ -n "$PAIRVIBE_ACTIVE" ]; then
    echo "%{$fg[yellow]%}⚡ pair-vibe%{$reset_color%} "
  fi
}
PROMPT='$(pairvibe_prompt_info)'"$PROMPT"
```

### iTerm2/WezTerm User Variables

User variables set via OSC 1337;SetUserVar can be read by shell integration to modify the prompt or tab title dynamically without modifying PS1 directly.

---

## 8. Sound/Haptic Feedback

### Terminal Bell (BEL)

```typescript
// Ring the terminal bell
process.stdout.write('\x07');
// or
process.stdout.write('\u0007');
// or
process.stderr.write('\x07');
```

**Support:** Universal, but behavior varies:
- Some terminals play a sound
- Some flash the screen (visual bell)
- Some show a notification badge on the dock/taskbar
- Some do nothing (bell disabled in settings)
- VS Code terminal: does NOT play sound by default
- Most terminals: requires "audible bell" to be enabled in preferences

**Auto-reverts:** N/A (one-shot event)

### Playing Actual Sounds

```typescript
import { exec } from 'child_process';

// macOS: play system sounds
exec('afplay /System/Library/Sounds/Glass.aiff');
exec('afplay /System/Library/Sounds/Ping.aiff');
exec('afplay /System/Library/Sounds/Pop.aiff');

// macOS: text-to-speech
exec('say "partner joined"');

// Linux: various options
exec('paplay /usr/share/sounds/freedesktop/stereo/message-new-instant.oga');
exec('aplay /path/to/sound.wav');

// Cross-platform with node
// npm package: play-sound
import player from 'play-sound';
player().play('notification.mp3');
```

**Recommended approach for pair-vibing:**
```typescript
function notifySound(event: 'join' | 'message' | 'leave'): void {
  // BEL as fallback
  process.stdout.write('\x07');

  // Platform-specific enhanced sound
  if (process.platform === 'darwin') {
    const sounds: Record<string, string> = {
      join: '/System/Library/Sounds/Glass.aiff',
      message: '/System/Library/Sounds/Tink.aiff',
      leave: '/System/Library/Sounds/Basso.aiff',
    };
    exec(`afplay ${sounds[event]}`);
  }
}
```

---

## 9. Desktop Notifications

### Cross-Platform: node-notifier

```typescript
import notifier from 'node-notifier';

notifier.notify({
  title: 'Pair Vibe',
  message: 'Alice joined the session',
  icon: path.join(__dirname, 'icon.png'),
  sound: true,
  wait: true,  // wait for user interaction
});

notifier.on('click', () => {
  // User clicked the notification - focus the terminal
});

notifier.on('close', () => {
  // Notification was dismissed
});
```

**Platform backends:**
- macOS: Notification Center (via terminal-notifier or native)
- Linux: notify-send (libnotify)
- Windows: Windows Toast notifications

### Terminal-Native Notifications

**OSC 9 (simple, broad support):**
```typescript
// Supported by: iTerm2, WezTerm, Ghostty, ConEmu, mintty
process.stdout.write(`\x1b]9;Alice joined the session\x07`);
```

**OSC 777 (rxvt-style, supported by WezTerm, Ghostty):**
```typescript
process.stdout.write(`\x1b]777;notify;Pair Vibe;Alice joined\x07`);
```

**OSC 99 (Kitty protocol, richest features):**
```typescript
function sendNotification(opts: {
  title: string;
  body?: string;
  urgency?: 0 | 1 | 2;
  sound?: string;
  buttons?: string[];
}): void {
  const id = `pv-${Date.now()}`;
  const urgency = opts.urgency ?? 1;

  if (opts.body) {
    process.stdout.write(`\x1b]99;i=${id}:d=0:u=${urgency}:a=report;${opts.title}\x1b\\`);
    process.stdout.write(`\x1b]99;i=${id}:p=body;${opts.body}\x1b\\`);
  } else {
    process.stdout.write(`\x1b]99;i=${id}:u=${urgency}:a=report;${opts.title}\x1b\\`);
  }
}
```

### Recommended Layered Strategy

```typescript
function notify(title: string, body: string): void {
  const term = process.env.TERM_PROGRAM || process.env.TERM || '';

  // Layer 1: Terminal-native notification
  if (term === 'iTerm.app') {
    process.stdout.write(`\x1b]9;${body}\x07`);
  } else if (term === 'xterm-kitty') {
    const id = `pv-${Date.now()}`;
    process.stdout.write(`\x1b]99;i=${id}:d=0;${title}\x1b\\`);
    process.stdout.write(`\x1b]99;i=${id}:p=body;${body}\x1b\\`);
  } else if (term === 'WezTerm' || term === 'xterm-ghostty') {
    process.stdout.write(`\x1b]9;${body}\x07`);
  }

  // Layer 2: OS-level notification (always, as backup)
  notifier.notify({ title, message: body, sound: true });
}
```

---

## 10. Persistent Status Bar

### How Claude Code Does It

Claude Code uses React with Ink for its terminal UI. Key architecture details:

- **NOT using alternate screen buffer** -- so users retain native terminal scrollback
- **Custom renderer** -- Anthropic rewrote Ink's renderer from scratch for better incremental updates
- **Synchronized output** (DEC mode 2026) to eliminate flickering
- **Status line** runs as a separate shell script that receives JSON session data on stdin and prints output; Claude Code displays whatever the script prints at the bottom

### Ink-Based Status Bar (React for Terminal)

```typescript
import React from 'react';
import { render, Box, Text, Spacer, useStdout } from 'ink';

const StatusBar: React.FC<{
  partner: string;
  status: 'connected' | 'disconnected';
  tokens: number;
}> = ({ partner, status, tokens }) => {
  const { stdout } = useStdout();
  const cols = stdout.columns;

  return (
    <Box flexDirection="column" height={stdout.rows}>
      {/* Main content area - scrollable */}
      <Box flexDirection="column" flexGrow={1}>
        {/* ... your main UI ... */}
      </Box>

      {/* Fixed status bar at bottom */}
      <Box
        width={cols}
        borderStyle="single"
        borderColor="yellow"
        paddingX={1}
      >
        <Text color="yellow" bold>
          ✦ pair-vibe
        </Text>
        <Text> </Text>
        <Text color={status === 'connected' ? 'green' : 'red'}>
          ● {partner}
        </Text>
        <Spacer />
        <Text dimColor>
          {tokens} tokens
        </Text>
      </Box>
    </Box>
  );
};

const { unmount } = render(<StatusBar partner="alice" status="connected" tokens={1234} />);
```

### Raw ANSI Status Bar (No Framework)

```typescript
class StatusBar {
  private lastContent = '';

  update(content: string): void {
    const rows = process.stdout.rows || 24;
    const cols = process.stdout.columns || 80;

    // Save cursor position
    process.stdout.write('\x1b7');

    // Move to last line
    process.stdout.write(`\x1b[${rows};1H`);

    // Draw status bar with reverse video
    const padded = content.padEnd(cols).substring(0, cols);
    process.stdout.write(`\x1b[7m${padded}\x1b[27m`);

    // Restore cursor position
    process.stdout.write('\x1b8');

    this.lastContent = content;
  }

  clear(): void {
    const rows = process.stdout.rows || 24;
    const cols = process.stdout.columns || 80;
    process.stdout.write('\x1b7');
    process.stdout.write(`\x1b[${rows};1H`);
    process.stdout.write(' '.repeat(cols));
    process.stdout.write('\x1b8');
  }
}

// Usage:
const bar = new StatusBar();
bar.update(' \u2726 pair-vibe \u25cf alice + bob  |  connected  |  1234 tokens');

// Update on resize
process.stdout.on('resize', () => {
  bar.update(bar['lastContent']);
});
```

### Scroll Region Technique

You can reserve the bottom line(s) by setting the terminal's scroll region:

```typescript
function reserveStatusLine(): void {
  const rows = process.stdout.rows || 24;
  // Set scroll region to exclude last line
  process.stdout.write(`\x1b[1;${rows - 1}r`);
  // Move cursor to top of scroll region
  process.stdout.write('\x1b[1;1H');
}

function releaseStatusLine(): void {
  const rows = process.stdout.rows || 24;
  // Reset scroll region to full screen
  process.stdout.write(`\x1b[1;${rows}r`);
}
```

This is how many TUI apps pin content to the bottom. The scroll region prevents normal output from overwriting the status bar.

---

## 11. Terminal Detection

### Identifying the Terminal Emulator

```typescript
interface TerminalInfo {
  name: string;
  supportsTruecolor: boolean;
  supportsImages: boolean;
  supportsOSC1337: boolean;
  supportsOSC99: boolean;
  supportsOSC9: boolean;
  supportsTabColor: boolean;
  supportsBadge: boolean;
  supportsProgressBar: boolean;
  supportsStyledUnderlines: boolean;
}

function detectTerminal(): TerminalInfo {
  const term = process.env.TERM || '';
  const termProgram = process.env.TERM_PROGRAM || '';
  const termProgramVersion = process.env.TERM_PROGRAM_VERSION || '';
  const wtSession = process.env.WT_SESSION;
  const colorterm = process.env.COLORTERM;

  if (termProgram === 'iTerm.app') {
    return {
      name: 'iTerm2',
      supportsTruecolor: true,
      supportsImages: true,
      supportsOSC1337: true,
      supportsOSC99: false,
      supportsOSC9: true,
      supportsTabColor: true,
      supportsBadge: true,
      supportsProgressBar: true,
      supportsStyledUnderlines: false,
    };
  }

  if (term === 'xterm-kitty') {
    return {
      name: 'Kitty',
      supportsTruecolor: true,
      supportsImages: true,     // Kitty graphics protocol
      supportsOSC1337: false,
      supportsOSC99: true,
      supportsOSC9: false,
      supportsTabColor: false,
      supportsBadge: false,
      supportsProgressBar: false,
      supportsStyledUnderlines: true,
    };
  }

  if (termProgram === 'WezTerm') {
    return {
      name: 'WezTerm',
      supportsTruecolor: true,
      supportsImages: true,     // iTerm2 + Kitty protocols
      supportsOSC1337: true,    // partial
      supportsOSC99: false,
      supportsOSC9: true,
      supportsTabColor: false,
      supportsBadge: false,
      supportsProgressBar: true,
      supportsStyledUnderlines: true,
    };
  }

  if (term === 'xterm-ghostty') {
    return {
      name: 'Ghostty',
      supportsTruecolor: true,
      supportsImages: false,
      supportsOSC1337: false,
      supportsOSC99: false,
      supportsOSC9: true,
      supportsTabColor: false,
      supportsBadge: false,
      supportsProgressBar: true,  // native GUI in v1.2+
      supportsStyledUnderlines: true,
    };
  }

  if (termProgram === 'Apple_Terminal') {
    return {
      name: 'Terminal.app',
      supportsTruecolor: false,
      supportsImages: false,
      supportsOSC1337: false,
      supportsOSC99: false,
      supportsOSC9: false,
      supportsTabColor: false,
      supportsBadge: false,
      supportsProgressBar: false,
      supportsStyledUnderlines: false,
    };
  }

  if (wtSession) {
    return {
      name: 'Windows Terminal',
      supportsTruecolor: true,
      supportsImages: false,
      supportsOSC1337: false,
      supportsOSC99: false,
      supportsOSC9: true,
      supportsTabColor: false,
      supportsBadge: false,
      supportsProgressBar: true,
      supportsStyledUnderlines: false,
    };
  }

  // Generic / unknown
  return {
    name: 'Unknown',
    supportsTruecolor: colorterm === 'truecolor' || colorterm === '24bit',
    supportsImages: false,
    supportsOSC1337: false,
    supportsOSC99: false,
    supportsOSC9: false,
    supportsTabColor: false,
    supportsBadge: false,
    supportsProgressBar: false,
    supportsStyledUnderlines: false,
  };
}
```

---

## 12. Cleanup & State Restoration

### Critical: Always Restore Terminal State on Exit

```typescript
class TerminalStateManager {
  private cleanupActions: Array<() => void> = [];
  private isCleanedUp = false;

  constructor() {
    // Register cleanup for all exit scenarios
    process.on('exit', () => this.cleanup());
    process.on('SIGINT', () => { this.cleanup(); process.exit(130); });
    process.on('SIGTERM', () => { this.cleanup(); process.exit(143); });
    process.on('uncaughtException', (err) => {
      this.cleanup();
      console.error(err);
      process.exit(1);
    });
  }

  register(description: string, action: () => void): void {
    this.cleanupActions.push(action);
  }

  private cleanup(): void {
    if (this.isCleanedUp) return;
    this.isCleanedUp = true;

    for (const action of this.cleanupActions.reverse()) {
      try {
        action();
      } catch {
        // Best effort cleanup
      }
    }
  }
}

// Usage:
const state = new TerminalStateManager();

// Cursor shape
process.stdout.write('\x1b[5 q');  // set to blinking bar
state.register('cursor shape', () => process.stdout.write('\x1b[0 q'));

// Cursor color
process.stdout.write('\x1b]12;#ff6600\x07');
state.register('cursor color', () => process.stdout.write('\x1b]112\x07'));

// Cursor visibility
process.stdout.write('\x1b[?25l');  // hide
state.register('cursor visibility', () => process.stdout.write('\x1b[?25h'));

// Terminal title
process.stdout.write('\x1b]0;pair-vibe session\x07');
state.register('title', () => process.stdout.write('\x1b]0;\x07'));

// Tab color (iTerm2)
state.register('tab color', () => process.stdout.write('\x1b]6;1;bg;*;default\x07'));

// Badge (iTerm2)
state.register('badge', () => {
  const empty = Buffer.from('').toString('base64');
  process.stdout.write(`\x1b]1337;SetBadgeFormat=${empty}\x07`);
});

// Scroll region
state.register('scroll region', () => {
  const rows = process.stdout.rows || 24;
  process.stdout.write(`\x1b[1;${rows}r`);
});

// Progress bar
state.register('progress', () => process.stdout.write('\x1b]9;4;0\x07'));

// Cursor guide (iTerm2)
state.register('cursor guide', () => {
  process.stdout.write('\x1b]1337;HighlightCursorLine=false\x07');
});
```

### What Auto-Reverts vs. What Doesn't

| Feature              | Auto-reverts on exit? | Must restore manually? |
|---------------------|----------------------|----------------------|
| Cursor visibility   | Usually yes          | Yes, to be safe      |
| Cursor shape        | No                   | Yes (\x1b[0 q)      |
| Cursor color        | No                   | Yes (\x1b]112\x07)  |
| Window title        | No                   | Yes                  |
| Tab color           | No                   | Yes                  |
| Badge               | No                   | Yes                  |
| Alternate screen    | Yes (if using 1049)  | Paired with enter    |
| Scroll region       | No                   | Yes                  |
| Text colors/styles  | Yes (per line)       | No (reset each line) |
| Progress bar        | No                   | Yes (state 0)        |
| Background color    | No                   | Yes                  |

### The restore-cursor Package

The `restore-cursor` npm package handles cursor visibility restoration specifically. It uses `onExit` to register handlers for process exit, SIGINT, SIGTERM, etc. Internally it saves cursor state with DECSC and shows the cursor with DECTCEM.

```typescript
import restoreCursor from 'restore-cursor';
restoreCursor(); // registers cleanup handlers automatically
```

---

## Quick Reference: Recommended "Active Session" Indicator Set

For a pair-vibing tool, here is a recommended layered approach using the techniques above:

### Universal (all terminals)
1. **Window title**: `\x1b]0;pair-vibe \u25cf alice + bob\x07`
2. **Colored star indicator**: `\x1b[38;5;174m\u2726\x1b[39m` in status output
3. **Terminal bell** on partner join: `\x07`
4. **Spinner** while waiting: braille dot animation
5. **Status bar** at bottom via scroll region or Ink
6. **Hyperlinks** for shared URLs via OSC 8

### iTerm2 Enhancements
7. **Tab color** set to session theme color
8. **Badge** showing "pair-vibe" as watermark
9. **Progress bar** during long operations
10. **Desktop notification** on partner activity
11. **Cursor guide line** enabled
12. **Request attention** (bounce dock icon) on important events

### Kitty Enhancements
7. **Rich desktop notifications** with buttons (OSC 99)
8. **Colored curly underlines** for highlighting
9. **Color stack** for save/restore palette

### WezTerm/Ghostty Enhancements
7. **User variables** for tab bar customization (WezTerm)
8. **Native progress bar** (Ghostty)
9. **OSC 9 notifications**

### OS-Level (via node-notifier)
- Desktop notifications for partner join/leave/prompt
- Sound effects via system audio

---

## Key npm Packages

| Package | Purpose |
|---------|---------|
| `ansi-escapes` | Comprehensive escape sequence constants |
| `restore-cursor` | Auto-restore cursor on exit |
| `ora` | Spinner animations |
| `cli-spinners` | 70+ spinner frame definitions |
| `ink` | React for terminal UIs |
| `node-notifier` | Cross-platform desktop notifications |
| `chalk` / `ansis` | Color/style helpers with auto-detection |
| `supports-color` | Color support detection |
| `term-size` | Terminal dimensions |
| `play-sound` | Cross-platform audio playback |

---

## Sources

- [ANSI Escape Sequences Gist (fnky)](https://gist.github.com/fnky/458719343aabd01cfb17a3a4f7296797)
- [DECSCUSR VT510 Reference](https://vt100.net/docs/vt510-rm/DECSCUSR.html)
- [iTerm2 Proprietary Escape Codes](https://iterm2.com/documentation-escape-codes.html)
- [iTerm2 Badges Documentation](https://iterm2.com/documentation-badges.html)
- [WezTerm Escape Sequences](https://wezterm.org/escape-sequences.html)
- [Kitty Protocol Extensions](https://sw.kovidgoyal.net/kitty/protocol-extensions/)
- [Kitty Desktop Notifications (OSC 99)](https://sw.kovidgoyal.net/kitty/desktop-notifications/)
- [Kitty Colored Underlines](https://sw.kovidgoyal.net/kitty/underlines/)
- [Kitty Graphics Protocol](https://sw.kovidgoyal.net/kitty/graphics-protocol/)
- [Ghostty Control Sequences](https://ghostty.org/docs/vt/concepts/sequences)
- [Ghostty ConEmu OSC 9 Extensions](https://ghostty.org/docs/vt/osc/conemu)
- [Progress Bars in Ghostty (Martin Emde)](https://martinemde.com/blog/ghostty-progress-bars)
- [OSC 9;4 Progress Bar Specification (rockorager)](https://rockorager.dev/misc/osc-9-4-progress-bars/)
- [Windows Terminal Virtual Terminal Sequences](https://learn.microsoft.com/en-us/windows/console/console-virtual-terminal-sequences)
- [Windows Terminal Progress Bars](https://learn.microsoft.com/en-us/windows/terminal/tutorials/progress-bar-sequences)
- [Hyperlinks in Terminal Emulators (egmontkob)](https://gist.github.com/egmontkob/eb114294efbcd5adb1944c9f3cb5feda)
- [OSC 8 Adoption Tracking](https://github.com/Alhadis/OSC8-Adoption)
- [ansi-escapes npm (sindresorhus)](https://github.com/sindresorhus/ansi-escapes)
- [cli-spinners npm (sindresorhus)](https://github.com/sindresorhus/cli-spinners)
- [ora npm (sindresorhus)](https://github.com/sindresorhus/ora)
- [Ink - React for CLI (vadimdemedes)](https://github.com/vadimdemedes/ink)
- [Ink TUI Expandable Layouts with Fixed Footer](https://combray.prose.sh/2025-11-28-ink-tui-expandable-layout)
- [node-notifier npm](https://github.com/mikaelbr/node-notifier)
- [restore-cursor npm](https://www.npmjs.com/package/restore-cursor)
- [Terminal Color Rendering (marvinh)](https://marvinh.dev/blog/terminal-colors/)
- [Alternate Screen Buffer (Terminal Guide)](https://terminalguide.namepad.de/mode/p47/)
- [Nerd Fonts](https://www.nerdfonts.com/)
- [Nerd Fonts Glyph Sets](https://github.com/ryanoasis/nerd-fonts/wiki/Glyph-Sets-and-Code-Points)
- [Claude Code Status Line Docs](https://code.claude.com/docs/en/statusline)
- [ccstatusline npm](https://www.npmjs.com/package/ccstatusline)
- [tmux FAQ - Window Titles](https://github.com/tmux/tmux/wiki/FAQ)
- [Claude Code Unicode Symbol Issue #24102](https://github.com/anthropics/claude-code/issues/24102)
- [Claude Code Cursor Shape Issue #10534](https://github.com/anthropics/claude-code/issues/10534)
- [DEC Modes Exhaustive List](https://github.com/bash/dec-modes)
- [State of the Terminal (gpanders)](https://gpanders.com/blog/state-of-the-terminal/)
- [Changing iTerm2 Tab Colors](https://deducement.com/posts/changing-iterm2-tab-colors/)
