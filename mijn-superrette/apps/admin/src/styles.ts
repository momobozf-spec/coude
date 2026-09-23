import { darkColors, lightColors, palette, radii } from '@superrette/ui/tokens';

/** Admin CSS generated from the shared design tokens. */
const vars = (c: typeof lightColors): string =>
  Object.entries(c)
    .map(([k, v]) => `--${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}: ${v};`)
    .join('\n');

export const css = `
:root { ${vars(lightColors)} --ink: ${palette.ink}; --radius: ${radii.md}px; color-scheme: light; }
@media (prefers-color-scheme: dark) { :root { ${vars(darkColors)} color-scheme: dark; } }
* { box-sizing: border-box; }
body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; background: var(--background); color: var(--text); font-size: 14px; }
a { color: var(--info); text-decoration: none; }
.layout { display: grid; grid-template-columns: 240px 1fr; min-height: 100vh; }
.sidebar { background: ${palette.ink}; color: ${palette.paper}; padding: 20px 14px; display: flex; flex-direction: column; gap: 4px; }
.sidebar .brand { display: flex; gap: 10px; align-items: center; margin-bottom: 24px; }
.sidebar .brand small { display: block; color: ${palette.apricot}; font-weight: 700; letter-spacing: 1.4px; font-size: 10px; }
.sidebar .brand strong { font-size: 18px; }
.sidebar a { color: ${palette.paper}; opacity: .8; padding: 9px 12px; border-radius: 10px; display: flex; justify-content: space-between; }
.sidebar a.active, .sidebar a:hover { background: rgba(255,255,255,.1); opacity: 1; }
.sidebar .count { background: ${palette.apricot}; color: #3A1B06; border-radius: 999px; padding: 0 8px; font-size: 12px; font-weight: 700; }
main { padding: 28px 32px; max-width: 1280px; }
h1 { font-size: 24px; margin: 0 0 4px; letter-spacing: -.3px; }
.subtitle { color: var(--text-muted); margin: 0 0 20px; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 18px; }
.grid { display: grid; gap: 14px; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); }
.stat .value { font-size: 28px; font-weight: 800; font-variant-numeric: tabular-nums; }
.stat .label { color: var(--text-muted); font-size: 12px; text-transform: uppercase; letter-spacing: .6px; font-weight: 700; }
table { width: 100%; border-collapse: collapse; background: var(--surface); border-radius: 14px; overflow: hidden; border: 1px solid var(--border); }
th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--border); vertical-align: top; }
th { font-size: 11px; text-transform: uppercase; letter-spacing: .6px; color: var(--text-muted); background: var(--surface-alt); }
td.num { font-variant-numeric: tabular-nums; text-align: right; }
.badge { display: inline-block; border-radius: 6px; padding: 2px 7px; font-size: 11px; font-weight: 700; letter-spacing: .4px; background: var(--surface-alt); color: var(--text-muted); }
.badge.success { background: var(--success-soft); color: var(--success); }
.badge.warning { background: var(--warning-soft); color: var(--warning); }
.badge.danger { background: var(--danger-soft); color: var(--danger); }
.badge.info { background: var(--info-soft); color: var(--info); }
.badge.promo { background: var(--accent); color: var(--on-accent); }
button { font: inherit; border: 0; border-radius: 999px; padding: 8px 16px; font-weight: 600; cursor: pointer; background: var(--surface-alt); color: var(--text); }
button.primary { background: var(--primary); color: var(--on-primary); }
button.success { background: var(--success); color: #fff; }
button.danger { background: var(--danger-soft); color: var(--danger); }
button:disabled { opacity: .5; cursor: default; }
input, select { font: inherit; padding: 9px 12px; border-radius: 10px; border: 1px solid var(--border); background: var(--surface); color: var(--text); }
.toolbar { display: flex; gap: 10px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
.match { display: grid; grid-template-columns: 1fr 1fr 180px; gap: 18px; align-items: start; }
.match h3 { margin: 4px 0; font-size: 16px; }
.muted { color: var(--text-muted); }
.meter { height: 6px; background: var(--surface-alt); border-radius: 3px; overflow: hidden; margin: 6px 0; }
.meter > div { height: 6px; }
.stack { display: flex; flex-direction: column; gap: 12px; }
.row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.error { color: var(--danger); }
.banner { background: var(--warning-soft); color: var(--warning); padding: 10px 14px; border-radius: 10px; font-weight: 700; margin-bottom: 16px; }
.login { max-width: 360px; margin: 12vh auto; display: flex; flex-direction: column; gap: 12px; }
code { font-size: 12px; background: var(--surface-alt); padding: 1px 5px; border-radius: 5px; }
`;
