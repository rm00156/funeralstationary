/**
 * Tiny fetch wrapper for the admin UI's mutations — client-safe, no DB.
 * Returns null on success or a human-readable error message on failure.
 */
export async function adminMutate(
  url: string,
  method: "POST" | "PATCH" | "PUT",
  body: unknown,
): Promise<string | null> {
  try {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.ok) return null;
    const { error } = (await response.json().catch(() => ({}))) as { error?: string };
    if (response.status === 401) return "Your admin session has expired — sign in again";
    return error ?? "Something went wrong — please try again";
  } catch {
    return "Something went wrong — please try again";
  }
}
