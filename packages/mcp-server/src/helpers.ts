import { ClavexAPIError } from "./client.js";

/**
 * Wraps a tool handler so API errors become user-facing error messages
 * instead of crashing the MCP server.
 */
export async function handleError<T>(
  fn: () => Promise<T>,
): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
  try {
    const result = await fn();
    return {
      content: [{ type: "text", text: typeof result === "string" ? result : JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    if (err instanceof ClavexAPIError) {
      return {
        content: [{ type: "text", text: `Error ${err.status}: ${err.message}` }],
        isError: true,
      };
    }
    if (err instanceof Error) {
      return {
        content: [{ type: "text", text: `Error: ${err.message}` }],
        isError: true,
      };
    }
    return {
      content: [{ type: "text", text: `Unknown error: ${String(err)}` }],
      isError: true,
    };
  }
}

/** Format an array of objects as a readable Markdown table. */
export function mdTable(rows: Record<string, unknown>[], cols?: string[]): string {
  if (!rows.length) return "_No results._";
  const keys = cols ?? Object.keys(rows[0]);
  const header = `| ${keys.join(" | ")} |`;
  const sep    = `| ${keys.map(() => "---").join(" | ")} |`;
  const body   = rows
    .map((r) => `| ${keys.map((k) => String(r[k] ?? "—")).join(" | ")} |`)
    .join("\n");
  return [header, sep, body].join("\n");
}
