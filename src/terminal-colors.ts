export interface SessionBackground {
  name: string;
  apply: string;
  textColor: "white" | "black";
}

// Colors matched to the social banner gradient: deep indigo/navy with subtle violet
const BACKGROUNDS: SessionBackground[] = [
  { name: "void",           apply: "\x1b[48;2;6;6;15m",   textColor: "white" },   // #06060f
  { name: "deep-indigo",    apply: "\x1b[48;2;14;14;36m", textColor: "white" },   // #0e0e24
  { name: "midnight-violet", apply: "\x1b[48;2;20;14;48m", textColor: "white" },  // #140e30
  { name: "dark-navy",      apply: "\x1b[48;2;10;10;28m", textColor: "white" },   // #0a0a1c
  { name: "indigo-black",   apply: "\x1b[48;2;12;10;30m", textColor: "white" },   // #0c0a1e
  { name: "deep-space",     apply: "\x1b[48;2;8;8;22m",   textColor: "white" },   // #080816
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
