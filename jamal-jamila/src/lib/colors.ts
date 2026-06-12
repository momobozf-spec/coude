/**
 * Maps human colour names (NL/oriental palette used across the catalogue) to a
 * CSS colour for the little swatch dots on product cards. Falls back to a warm
 * neutral for anything unknown.
 */
const MAP: Record<string, string> = {
  goud: "#c2904f",
  amber: "#b9633e",
  brons: "#9c6b3f",
  koper: "#a85a32",
  terracotta: "#b9633e",
  karamel: "#c08552",
  groen: "#7c7a4e",
  olijf: "#7c7a4e",
  munt: "#9bb39a",
  blauw: "#3f5d72",
  kobalt: "#2f4a6b",
  turquoise: "#3a8d8d",
  zwart: "#2b2118",
  espresso: "#3d2f23",
  bruin: "#6b4b34",
  wit: "#f6f1e8",
  crème: "#efe6d4",
  creme: "#efe6d4",
  zand: "#e7dcc8",
  beige: "#e0d2ba",
  helder: "#eef2f4",
  transparant: "#eef2f4",
  rood: "#a8362c",
  bordeaux: "#7a2f2a",
  roze: "#d8a7a0",
  zilver: "#c9c9c4",
  goudgeel: "#d8b078",
  paars: "#6b4a6b",
};

export function colorSwatch(name: string): string {
  const key = name.trim().toLowerCase();
  if (MAP[key]) return MAP[key];
  // Try first word (e.g. "Goud mat" → "goud")
  const first = key.split(/[\s/-]/)[0];
  return MAP[first] || "#c9b79c";
}
