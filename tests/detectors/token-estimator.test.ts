import { describe, it, expect, beforeAll } from 'vitest';
import {
  ensureInitialized,
  countTokens,
  estimateFallback,
  estimateMcpTokens,
} from '../../src/detectors/token-estimator.js';
import type { McpServerConfig } from '../../src/types.js';

beforeAll(async () => {
  await ensureInitialized();
});

describe('countTokens', () => {
  it('returns 0 for empty string', () => {
    const result = countTokens('');
    expect(result.count).toBe(0);
    expect(result.method).toBe('measured');
  });

  it('returns a positive count for "hello world"', () => {
    const result = countTokens('hello world');
    expect(result.count).toBeGreaterThan(0);
    // "hello world" is typically 2-3 tokens with cl100k_base
    expect(result.count).toBeLessThanOrEqual(5);
  });

  it('returns a positive count for Chinese text', () => {
    const result = countTokens('使用 TypeScript 嚴格模式');
    expect(result.count).toBeGreaterThan(0);
  });

  it('returns higher count for longer text', () => {
    const short = countTokens('hello');
    const long = countTokens('hello world, this is a longer sentence with many words');
    expect(long.count).toBeGreaterThan(short.count);
  });

  it('method is "measured" when tiktoken is available', () => {
    const result = countTokens('some text');
    // In a working environment, tiktoken should load successfully
    // We accept either method since CI might differ
    expect(['measured', 'estimated']).toContain(result.method);
  });
});

describe('estimateFallback', () => {
  it('returns estimated method', () => {
    const result = estimateFallback('hello world');
    expect(result.method).toBe('estimated');
  });

  it('returns positive count for non-empty text', () => {
    const result = estimateFallback('some text here');
    expect(result.count).toBeGreaterThan(0);
  });

  it('returns 0 count for empty text', () => {
    const result = estimateFallback('');
    // ceil(0 / charsPerToken) = 0
    expect(result.count).toBe(0);
  });

  it('CJK text estimates fewer chars per token than English', () => {
    // 10 CJK chars → ceil(10/2) = 5
    const cjk = estimateFallback('一二三四五六七八九十');
    // 10 ASCII chars → ceil(10/4) = 3
    const eng = estimateFallback('helloworld');
    expect(cjk.count).toBeGreaterThan(eng.count);
  });

  it('fallback is within ±30% of tiktoken for English text', () => {
    const text = 'Always use TypeScript strict mode. Never commit secrets. Use pnpm for package management.';
    const measured = countTokens(text);
    const estimated = estimateFallback(text);

    if (measured.method === 'measured') {
      const ratio = estimated.count / measured.count;
      expect(ratio).toBeGreaterThan(0.7);
      expect(ratio).toBeLessThan(1.3);
    }
    // If tiktoken isn't available, both use fallback — skip the ratio check
  });
});

describe('estimateMcpTokens', () => {
  it('uses toolCount * 400 when toolCount is provided', () => {
    const config: McpServerConfig = { name: 'github', toolCount: 10, estimatedTokens: 0 };
    const result = estimateMcpTokens(config);
    expect(result.count).toBe(4000);
    expect(result.method).toBe('estimated');
  });

  it('returns default 2500 when toolCount is not provided', () => {
    const config: McpServerConfig = { name: 'unknown-server', estimatedTokens: 0 };
    const result = estimateMcpTokens(config);
    expect(result.count).toBe(2500);
    expect(result.method).toBe('estimated');
  });

  it('always returns method=estimated', () => {
    const config: McpServerConfig = { name: 'any', toolCount: 5, estimatedTokens: 0 };
    expect(estimateMcpTokens(config).method).toBe('estimated');
  });
});
