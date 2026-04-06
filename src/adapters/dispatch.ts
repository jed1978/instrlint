import { loadClaudeCodeProject } from "./claude-code.js";
import { loadCodexProject } from "./codex.js";
import { loadCursorProject } from "./cursor.js";
import type { ParsedInstructions, ToolType } from "../types.js";

export function loadProject(
  projectRoot: string,
  tool: ToolType,
): ParsedInstructions {
  switch (tool) {
    case "claude-code":
      return loadClaudeCodeProject(projectRoot);
    case "codex":
      return loadCodexProject(projectRoot);
    case "cursor":
      return loadCursorProject(projectRoot);
    default:
      return loadClaudeCodeProject(projectRoot);
  }
}
