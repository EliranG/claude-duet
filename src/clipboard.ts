import { execSync } from "node:child_process";
import { platform } from "node:os";

export function copyToClipboard(text: string): boolean {
  try {
    const os = platform();
    if (os === "darwin") {
      execSync("pbcopy", { input: text, stdio: ["pipe", "ignore", "ignore"] });
      return true;
    }
    if (os === "linux") {
      // Try xclip first, then xsel
      try {
        execSync("xclip -selection clipboard", { input: text, stdio: ["pipe", "ignore", "ignore"] });
        return true;
      } catch {
        execSync("xsel --clipboard --input", { input: text, stdio: ["pipe", "ignore", "ignore"] });
        return true;
      }
    }
    if (os === "win32") {
      execSync("clip", { input: text, stdio: ["pipe", "ignore", "ignore"] });
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
