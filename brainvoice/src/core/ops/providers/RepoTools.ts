import { DomainError } from '../../types/common';

/**
 * Bounded repository tools for the Software Engineer role (§175). The interface only
 * exposes named operations; there is deliberately no "run this command" method, so an
 * LLM-generated shell line can never be executed. The Node implementation lives in
 * `server/repo/LocalRepoTools.ts` with an allow-list of npm scripts.
 */

export interface RepoSummary {
  root: string;
  name: string | null;
  branch: string | null;
  fileCount: number;
  topLevel: string[];
  scripts: string[];
}

export interface SearchHit {
  path: string;
  line: number;
  text: string;
}

export interface CommandResult {
  command: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  truncated: boolean;
}

export type FileEdit = { kind: 'replace'; find: string; replace: string } | { kind: 'write'; content: string };

export interface RepoTools {
  readonly id: string;
  isAvailable(): Promise<boolean>;
  inspect(): Promise<RepoSummary>;
  search(query: string, options?: { glob?: string | null; limit?: number }): Promise<SearchHit[]>;
  readFile(path: string, options?: { maxBytes?: number }): Promise<string>;
  editFile(path: string, edits: FileEdit[]): Promise<{ changed: boolean; bytes: number }>;
  runTests(): Promise<CommandResult>;
  runTypecheck(): Promise<CommandResult>;
  runLint(): Promise<CommandResult>;
  build(): Promise<CommandResult>;
  gitDiff(): Promise<string>;
  /** Writes nothing to git: returns the exact command and files for the user to run after approval. */
  prepareCommit(message: string): Promise<{ command: string; files: string[]; message: string }>;
  preparePR(title: string, body: string): Promise<{ title: string; body: string; command: string }>;
}

export class UnavailableRepoTools implements RepoTools {
  readonly id = 'none';
  async isAvailable(): Promise<boolean> {
    return false;
  }
  async inspect(): Promise<RepoSummary> {
    throw unavailable();
  }
  async search(): Promise<SearchHit[]> {
    throw unavailable();
  }
  async readFile(): Promise<string> {
    throw unavailable();
  }
  async editFile(): Promise<{ changed: boolean; bytes: number }> {
    throw unavailable();
  }
  async runTests(): Promise<CommandResult> {
    throw unavailable();
  }
  async runTypecheck(): Promise<CommandResult> {
    throw unavailable();
  }
  async runLint(): Promise<CommandResult> {
    throw unavailable();
  }
  async build(): Promise<CommandResult> {
    throw unavailable();
  }
  async gitDiff(): Promise<string> {
    throw unavailable();
  }
  async prepareCommit(): Promise<{ command: string; files: string[]; message: string }> {
    throw unavailable();
  }
  async preparePR(): Promise<{ title: string; body: string; command: string }> {
    throw unavailable();
  }
}

function unavailable(): DomainError {
  return new DomainError('REPO_UNAVAILABLE', 'No repository is configured for the software engineer (set ALFRED_REPO_PATH on the server)');
}

/** Creative-content seam (§176): text goes through the AIGateway; images/video need a provider that does not exist yet. */
export interface CreativeProvider {
  readonly id: string;
  capabilities(): { text: boolean; image: boolean; video: boolean };
  isAvailable(): Promise<boolean>;
}

export class NullCreativeProvider implements CreativeProvider {
  readonly id = 'none';
  capabilities(): { text: boolean; image: boolean; video: boolean } {
    return { text: false, image: false, video: false };
  }
  async isAvailable(): Promise<boolean> {
    return false;
  }
}
