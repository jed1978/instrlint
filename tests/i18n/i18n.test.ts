import { describe, it, expect, beforeEach } from 'vitest';
import { t, initLocale, detectLocale, getLocale, plural } from '../../src/i18n/index.js';
import enMessages from '../../src/i18n/en.json';
import zhTWMessages from '../../src/i18n/zh-TW.json';

// ─── Key parity ───────────────────────────────────────────────────────────────

describe('locale key parity', () => {
  it('en.json and zh-TW.json have exactly the same keys', () => {
    const enKeys = Object.keys(enMessages).sort();
    const zhKeys = Object.keys(zhTWMessages).sort();
    expect(enKeys).toEqual(zhKeys);
  });

  it('no key is empty in en.json', () => {
    for (const [key, value] of Object.entries(enMessages)) {
      expect(value, `key "${key}" is empty`).not.toBe('');
    }
  });

  it('no key is empty in zh-TW.json', () => {
    for (const [key, value] of Object.entries(zhTWMessages)) {
      expect(value, `key "${key}" is empty`).not.toBe('');
    }
  });
});

// ─── t() function ─────────────────────────────────────────────────────────────

describe('t() in en locale', () => {
  beforeEach(() => {
    initLocale('en');
  });

  it('returns the English string for a known key', () => {
    expect(t('label.tokenBudget')).toBe('TOKEN BUDGET');
  });

  it('returns the key itself for an unknown key', () => {
    expect(t('this.key.does.not.exist')).toBe('this.key.does.not.exist');
  });

  it('interpolates {{param}} placeholders', () => {
    expect(t('error.missingRootFile', { tool: 'claude-code' })).toBe(
      'Found claude-code configuration but no root instruction file.',
    );
  });

  it('leaves unmatched placeholders as-is', () => {
    expect(t('error.missingRootFile', {})).toBe(
      'Found {{tool}} configuration but no root instruction file.',
    );
  });

  it('interpolates multiple params', () => {
    const result = t('status.fixedIssues', { count: '3', s: 's' });
    expect(result).toContain('3');
    expect(result).toContain('git diff');
  });

  it('plural() returns s for count > 1', () => {
    expect(plural(2)).toBe('s');
    expect(plural(10)).toBe('s');
  });

  it('plural() returns empty string for count === 1', () => {
    expect(plural(1)).toBe('');
  });
});

describe('t() in zh-TW locale', () => {
  beforeEach(() => {
    initLocale('zh-TW');
  });

  it('returns Traditional Chinese string for a known key', () => {
    expect(t('label.tokenBudget')).toBe('TOKEN 預算');
  });

  it('returns the key itself for unknown key (fallback)', () => {
    expect(t('no.such.key')).toBe('no.such.key');
  });

  it('interpolates params in zh-TW template', () => {
    expect(t('error.missingRootFile', { tool: 'claude-code' })).toBe(
      '找到 claude-code 配置，但找不到根指令檔。',
    );
  });

  it('budget finding renders in zh-TW', () => {
    const result = t('budget.rootFileWarning', { lines: '206' });
    expect(result).toContain('206');
    expect(result).toMatch(/行/);
  });

  it('dead-rule finding renders in zh-TW', () => {
    const result = t('deadRule.configOverlap', {
      rule: 'Always use TypeScript strict mode',
      config: 'tsconfig.json (compilerOptions.strict: true)',
    });
    expect(result).toContain('tsconfig.json');
    expect(result).toContain('強制執行');
  });

  it('structure finding renders in zh-TW', () => {
    const result = t('structure.staleRef', { path: 'src/legacy/OldService.ts' });
    expect(result).toContain('src/legacy/OldService.ts');
    expect(result).toContain('不存在');
  });
});

// ─── initLocale / detectLocale ────────────────────────────────────────────────

describe('initLocale', () => {
  it('sets locale to en for valid en', () => {
    initLocale('en');
    expect(getLocale()).toBe('en');
  });

  it('sets locale to zh-TW for valid zh-TW', () => {
    initLocale('zh-TW');
    expect(getLocale()).toBe('zh-TW');
  });

  it('falls back to detected locale for unknown lang', () => {
    // Pass something invalid — should not throw, just use detected locale
    initLocale('fr');
    expect(['en', 'zh-TW']).toContain(getLocale());
  });

  it('falls back to detected locale for undefined', () => {
    initLocale(undefined);
    expect(['en', 'zh-TW']).toContain(getLocale());
  });
});

describe('detectLocale', () => {
  it('returns a valid locale', () => {
    const locale = detectLocale();
    expect(['en', 'zh-TW']).toContain(locale);
  });

  it('respects INSTRLINT_LANG=zh-TW env var', () => {
    const orig = process.env['INSTRLINT_LANG'];
    process.env['INSTRLINT_LANG'] = 'zh-TW';
    expect(detectLocale()).toBe('zh-TW');
    if (orig === undefined) delete process.env['INSTRLINT_LANG'];
    else process.env['INSTRLINT_LANG'] = orig;
  });

  it('respects INSTRLINT_LANG=en env var', () => {
    const orig = process.env['INSTRLINT_LANG'];
    process.env['INSTRLINT_LANG'] = 'en';
    expect(detectLocale()).toBe('en');
    if (orig === undefined) delete process.env['INSTRLINT_LANG'];
    else process.env['INSTRLINT_LANG'] = orig;
  });
});
