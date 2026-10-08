/**
 * Tiny fetch wrappers for the admin UI's mutations — client-safe, no DB.
 * adminMutate returns null on success or a human-readable error message on
 * failure; adminRequest returns the response body as well.
 */
export type AdminRequestResult<T> = { ok: true; body: T } | { ok: false; error: string };

/** adminMutate, for a mutation whose response body the caller needs. */
export async function adminRequest<T = unknown>(
  url: string,
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  body?: unknown,
): Promise<AdminRequestResult<T>> {
  try {
    const response = await fetch(url, {
      method,
      // DELETE carries no payload — sending an empty body and a JSON
      // content-type on one is just noise.
      ...(body === undefined
        ? {}
        : {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }),
    });
    const parsed = (await response.json().catch(() => ({}))) as T & { error?: string };
    if (response.ok) return { ok: true, body: parsed };
    if (response.status === 401) return { ok: false, error: "Your admin session has expired — sign in again" };
    return { ok: false, error: parsed.error ?? "Something went wrong — please try again" };
  } catch {
    return { ok: false, error: "Something went wrong — please try again" };
  }
}

export async function adminMutate(
  url: string,
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  body?: unknown,
): Promise<string | null> {
  const result = await adminRequest(url, method, body);
  return result.ok ? null : result.error;
}
