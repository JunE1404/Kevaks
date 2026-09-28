export type ErrorCode = "e20" | "e21" | "unknown";

export async function readErrorCode(res: Response): Promise<ErrorCode> {
  try {
    const data = (await res.json()) as { error?: string };
    if (data.error === "e20" || data.error === "e21") {
      return data.error;
    }
  } catch {
    // malformed or empty body
  }
  return "unknown";
}
