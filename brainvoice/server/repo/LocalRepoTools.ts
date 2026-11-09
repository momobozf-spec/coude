import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import type { CommandResult, FileEdit, RepoSummary, RepoTools, SearchHit } from '../../src/core/ops/providers/RepoTools';
import { DomainError } from '../../src/core/types/common';

/**
 * Bounded repository tools for the Software Engineer role (§175). Commands are an
 * allow-list of npm scripts spawned without a shell; file access is confined to the
 * repository root; output and run time are capped. There is no way to run an arbitrary
 * command, whatever an LLM produced.
 */

const SCRIPTS: Record<'test' | 'typecheck' | 'lint' | 'build', string[]> = {
  test: ['run', 'test', '--', '--run'],
  typecheck: ['run', 'typecheck'],
  lint: ['run', 'lint'],
  build: ['run', 'build'],
};

const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.expo', 'ios', 'android', '.next']);
const MAX_OUTPUT = 20_000;
const MAX_FILE_BYTES = 200_000;

export class LocalRepoTools implements RepoTools {
  readonly id = 'local-repo';

  constructor(
    private readonly root: string,
    private readonly options: { timeoutMs?: number; npmCommand?: string } = {},
  ) {}

  async isAvailable(): Promise<boolean> {
    try {
      const stat = await fs.stat(this.root);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  private resolve(relative: string): string {
    const target = path.resolve(this.root, relative);
    if (target !== this.root && !target.startsWith(this.root + path.sep)) throw new DomainError('INVALID_ARGUMENTS', `Path escapes the repository: ${relative}`);
    return target;
  }

  async inspect(): Promise<RepoSummary> {
    const [entries, pkg, branch] = await Promise.all([fs.readdir(this.root, { withFileTypes: true }), this.readJson('package.json'), this.readText('.git/HEAD').catch(() => null)]);
    let fileCount = 0;
    await this.walk(this.root, () => {
      fileCount++;
    }, 20_000);
    return {
      root: this.root,
      name: typeof pkg?.name === 'string' ? pkg.name : null,
      branch: branch ? branch.replace(/^ref:\s*refs\/heads\//, '').trim() : null,
      fileCount,
      topLevel: entries.map((e) => (e.isDirectory() ? `${e.name}/` : e.name)).sort(),
      scripts: pkg && typeof pkg.scripts === 'object' && pkg.scripts ? Object.keys(pkg.scripts as Record<string, unknown>) : [],
    };
  }

  async search(query: string, options: { glob?: string | null; limit?: number } = {}): Promise<SearchHit[]> {
    const needle = query.toLowerCase();
    const limit = options.limit ?? 50;
    const ext = options.glob ? options.glob.replace(/^\*\*\/\*/, '').replace(/^\*/, '') : null;
    const hits: SearchHit[] = [];
    await this.walk(this.root, async (file) => {
      if (hits.length >= limit) return;
      if (ext && !file.endsWith(ext)) return;
      if (!/\.(ts|tsx|js|jsx|json|md|yml|yaml|css|html|txt|mjs|cjs)$/.test(file)) return;
      const text = await fs.readFile(file, 'utf8').catch(() => '');
      if (text.length > 2_000_000) return;
      const lines = text.split('\n');
      for (let i = 0; i < lines.length && hits.length < limit; i++) {
        if (lines[i]!.toLowerCase().includes(needle)) hits.push({ path: path.relative(this.root, file).split(path.sep).join('/'), line: i + 1, text: lines[i]!.trim().slice(0, 200) });
      }
    }, 20_000);
    return hits;
  }

  async readFile(relative: string, options: { maxBytes?: number } = {}): Promise<string> {
    const target = this.resolve(relative);
    const stat = await fs.stat(target);
    const max = options.maxBytes ?? MAX_FILE_BYTES;
    if (stat.size > max) throw new DomainError('INVALID_ARGUMENTS', `File larger than ${max} bytes`);
    return fs.readFile(target, 'utf8');
  }

  async editFile(relative: string, edits: FileEdit[]): Promise<{ changed: boolean; bytes: number }> {
    const target = this.resolve(relative);
    let content = await fs.readFile(target, 'utf8').catch(() => '');
    const before = content;
    for (const edit of edits) {
      if (edit.kind === 'write') content = edit.content;
      else {
        if (!content.includes(edit.find)) throw new DomainError('INVALID_ARGUMENTS', `Text to replace not found in ${relative}`);
        content = content.replace(edit.find, () => edit.replace);
      }
    }
    if (content === before) return { changed: false, bytes: Buffer.byteLength(content) };
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content, 'utf8');
    return { changed: true, bytes: Buffer.byteLength(content) };
  }

  runTests(): Promise<CommandResult> {
    return this.runScript('test');
  }

  runTypecheck(): Promise<CommandResult> {
    return this.runScript('typecheck');
  }

  runLint(): Promise<CommandResult> {
    return this.runScript('lint');
  }

  build(): Promise<CommandResult> {
    return this.runScript('build');
  }

  async gitDiff(): Promise<string> {
    const result = await this.spawn('git', ['diff', '--stat', '--no-color'], 30_000);
    const full = await this.spawn('git', ['diff', '--no-color'], 30_000);
    return `${result.stdout}\n${full.stdout}`.trim().slice(0, 60_000);
  }

  async prepareCommit(message: string): Promise<{ command: string; files: string[]; message: string }> {
    const status = await this.spawn('git', ['status', '--porcelain'], 30_000);
    const files = status.stdout.split('\n').map((l) => l.slice(3).trim()).filter(Boolean);
    const safeMessage = message.replace(/"/g, '\\"').slice(0, 500);
    return { command: `git add -A && git commit -m "${safeMessage}"`, files, message };
  }

  async preparePR(title: string, body: string): Promise<{ title: string; body: string; command: string }> {
    const branch = (await this.spawn('git', ['rev-parse', '--abbrev-ref', 'HEAD'], 10_000)).stdout.trim() || 'HEAD';
    return { title, body, command: `gh pr create --title "${title.replace(/"/g, '\\"').slice(0, 200)}" --body-file <body> --head ${branch}` };
  }

  // ---------------------------------------------------------------------------

  private runScript(name: keyof typeof SCRIPTS): Promise<CommandResult> {
    const npm = this.options.npmCommand ?? (process.platform === 'win32' ? 'npm.cmd' : 'npm');
    return this.spawn(npm, SCRIPTS[name], this.options.timeoutMs ?? 10 * 60_000);
  }

  private spawn(command: string, args: string[], timeoutMs: number): Promise<CommandResult> {
    const started = Date.now();
    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let truncated = false;
      const child = spawn(command, args, { cwd: this.root, shell: false, env: { ...process.env, CI: '1', FORCE_COLOR: '0' }, windowsHide: true });
      const append = (target: 'out' | 'err', chunk: Buffer) => {
        const text = chunk.toString('utf8');
        if (target === 'out') stdout += text;
        else stderr += text;
        if (stdout.length > MAX_OUTPUT) {
          stdout = stdout.slice(-MAX_OUTPUT);
          truncated = true;
        }
        if (stderr.length > MAX_OUTPUT) {
          stderr = stderr.slice(-MAX_OUTPUT);
          truncated = true;
        }
      };
      child.stdout?.on('data', (chunk: Buffer) => append('out', chunk));
      child.stderr?.on('data', (chunk: Buffer) => append('err', chunk));
      const timer = setTimeout(() => {
        child.kill();
        stderr += `\n[timeout after ${timeoutMs} ms]`;
      }, timeoutMs);
      child.on('error', (error) => {
        clearTimeout(timer);
        resolve({ command: `${command} ${args.join(' ')}`, exitCode: null, stdout, stderr: `${stderr}\n${error.message}`, durationMs: Date.now() - started, truncated });
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        resolve({ command: `${command} ${args.join(' ')}`, exitCode: code, stdout, stderr, durationMs: Date.now() - started, truncated });
      });
    });
  }

  private async readJson(relative: string): Promise<Record<string, unknown> | null> {
    try {
      return JSON.parse(await fs.readFile(this.resolve(relative), 'utf8')) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private readText(relative: string): Promise<string> {
    return fs.readFile(this.resolve(relative), 'utf8');
  }

  private async walk(dir: string, visit: (file: string) => void | Promise<void>, budget: number): Promise<number> {
    let remaining = budget;
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (remaining <= 0) break;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) continue;
        remaining = await this.walk(full, visit, remaining);
      } else if (entry.isFile()) {
        await visit(full);
        remaining--;
      }
    }
    return remaining;
  }
}
