export interface SessionBackground {
  name: string;
  apply: string;
  textColor: "white" | "black";
}

const BACKGROUNDS: SessionBackground[] = [
  { name: "deep-purple", apply: "\x1b[48;2;30;20;60m", textColor: "white" },
  { name: "midnight-blue", apply: "\x1b[48;2;15;25;55m", textColor: "white" },
  { name: "dark-teal", apply: "\x1b[48;2;10;40;45m", textColor: "white" },
  { name: "deep-green", apply: "\x1b[48;2;15;35;25m", textColor: "white" },
  { name: "dark-plum", apply: "\x1b[48;2;45;20;45m", textColor: "white" },
  { name: "navy", apply: "\x1b[48;2;10;15;45m", textColor: "white" },
  { name: "dark-maroon", apply: "\x1b[48;2;45;15;20m", textColor: "white" },
  { name: "charcoal-violet", apply: "\x1b[48;2;35;25;50m", textColor: "white" },
];

export function pickSessionBackground(): SessionBackground {
  const idx = Math.floor(Math.random() * BACKGROUNDS.length);
  return BACKGROUNDS[idx];
}

export function applyBackground(bg: SessionBackground): string {
  return `${bg.apply}`;
}

export function restoreBackground(): string {
  return "\x1b[0m\x1b[49m";
}
