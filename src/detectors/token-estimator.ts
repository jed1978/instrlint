import type { McpServerConfig, TokenMethod } from "../types.js";

// ─── Tiktoken singleton ────────────────────────────────────────────────────

interface TiktokenEncoder {
  encode(text: string): ArrayLike<number>;
}

let encoder: TiktokenEncoder | null = null;
let initialized = false;

async function initEncoder(): Promise<void> {
  if (initialized) return;
  initialized = true;
  try {
    const { getEncoding } = await import("js-tiktoken");
    encoder = getEncoding("cl100k_base");
  } catch {
    process.stderr.write(
      "[instrlint] Warning: js-tiktoken failed to load — falling back to character estimation\n",
    );
    encoder = null;
  }
}

// Eagerly kick off initialization (fire-and-forget at module load).
// Callers that need synchronous access must call ensureInitialized() first.
void initEncoder();

export async function ensureInitialized(): Promise<void> {
  await initEncoder();
}

// ─── CJK character detection ───────────────────────────────────────────────

const CJK_REGEX = /[\u3000-\u9fff\uac00-\ud7af\uf900-\ufaff]/g;

function cjkRatio(text: string): number {
  if (text.length === 0) return 0;
  const matches = text.match(CJK_REGEX);
  return (matches?.length ?? 0) / text.length;
}

// ─── Public API ────────────────────────────────────────────────────────────

export interface TokenCount {
  count: number;
  method: TokenMethod;
}

export function countTokens(text: string): TokenCount {
  if (text.length === 0) return { count: 0, method: "measured" };

  if (encoder != null) {
    try {
      return { count: encoder.encode(text).length, method: "measured" };
    } catch {
      // Fall through to estimation
    }
  }

  return estimateFallback(text);
}

export function estimateFallback(text: string): TokenCount {
  const ratio = cjkRatio(text);
  const charsPerToken = 4 * (1 - ratio) + 2 * ratio;
  return {
    count: Math.ceil(text.length / charsPerToken),
    method: "estimated",
  };
}

export function estimateMcpTokens(config: McpServerConfig): {
  count: number;
  method: "estimated";
} {
  if (config.toolCount != null) {
    return { count: config.toolCount * 400, method: "estimated" };
  }
  // Default: assume a small server (~2500 tokens)
  return { count: 2500, method: "estimated" };
}
