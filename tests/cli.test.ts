import { describe, it, expect } from 'vitest';
import { execFileSync } from 'child_process';
import { join } from 'path';

const CLI = join(import.meta.dirname ?? new URL('.', import.meta.url).pathname, '../dist/cli.js');

function runCli(args: string[]): { stdout: string; stderr: string; code: number } {
  try {
    const stdout = execFileSync('node', [CLI, ...args], { encoding: 'utf8' });
    return { stdout, stderr: '', code: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? '',
      code: e.status ?? 1,
    };
  }
}

describe('CLI', () => {
  it('--help outputs usage', () => {
    const { stdout, code } = runCli(['--help']);
    expect(code).toBe(0);
    expect(stdout).toContain('instrlint');
    expect(stdout).toContain('--format');
    expect(stdout).toContain('--lang');
    expect(stdout).toContain('--fix');
  });

  it('--help lists all subcommands', () => {
    const { stdout, code } = runCli(['--help']);
    expect(code).toBe(0);
    expect(stdout).toContain('budget');
    expect(stdout).toContain('deadrules');
    expect(stdout).toContain('structure');
    expect(stdout).toContain('install');
  });

  it('budget subcommand prints not-implemented message', () => {
    const { stdout, code } = runCli(['budget']);
    expect(code).toBe(0);
    expect(stdout).toContain('Not implemented yet');
  });

  it('deadrules subcommand prints not-implemented message', () => {
    const { stdout, code } = runCli(['deadrules']);
    expect(code).toBe(0);
    expect(stdout).toContain('Not implemented yet');
  });

  it('structure subcommand prints not-implemented message', () => {
    const { stdout, code } = runCli(['structure']);
    expect(code).toBe(0);
    expect(stdout).toContain('Not implemented yet');
  });

  it('root command prints not-implemented message', () => {
    const { stdout, code } = runCli([]);
    expect(code).toBe(0);
    expect(stdout).toContain('Not implemented yet');
  });

  it('--version prints version number', () => {
    const { stdout, code } = runCli(['--version']);
    expect(code).toBe(0);
    expect(stdout).toContain('0.1.0');
  });
});
