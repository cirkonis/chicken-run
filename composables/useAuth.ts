/**
 * Composable: SSR-safe auth state with automatic token refresh.
 *
 * - Stores session in localStorage (access token, refresh token, expiry)
 * - `authFetch()` proactively refreshes tokens within 60s of expiry
 * - On 401 response: attempts one refresh + retry before logging out
 */
import type { AuthUser } from "~/types";

/** Seconds before expiry at which we proactively refresh. */
const REFRESH_BUFFER_SECS = 60;

export function useAuth() {
  const router = useRouter();

  const state = useState<{
    user: AuthUser | null;
    accessToken: string | null;
    refreshToken: string | null;
    expiresAt: number | null; // Unix epoch seconds
    loading: boolean;
  }>("auth", () => ({
    user: null,
    accessToken: null,
    refreshToken: null,
    expiresAt: null,
    loading: true,
  }));

  // ── Persistence ────────────────────────────────────────

  /** Restore session from localStorage — call once from onMounted. */
  function restore() {
    if (!import.meta.client) {
      state.value.loading = false;
      return;
    }
    try {
      const saved = localStorage.getItem("chickenrun_session");
      if (saved) {
        const parsed = JSON.parse(saved);
        state.value.user = parsed.user;
        state.value.accessToken = parsed.accessToken;
        state.value.refreshToken = parsed.refreshToken;
        state.value.expiresAt = parsed.expiresAt ?? null;
      }
    } catch {
      // Corrupt storage — ignore
    }
    state.value.loading = false;
  }

  function persist() {
    if (!import.meta.client) return;
    if (state.value.user && state.value.accessToken) {
      localStorage.setItem(
        "chickenrun_session",
        JSON.stringify({
          user: state.value.user,
          accessToken: state.value.accessToken,
          refreshToken: state.value.refreshToken,
          expiresAt: state.value.expiresAt,
        })
      );
    } else {
      localStorage.removeItem("chickenrun_session");
    }
  }

  // ── Session management ─────────────────────────────────

  /** Apply a new session from an API response. */
  function applySession(
    session: { access_token: string; refresh_token: string; expires_at?: number },
    user?: AuthUser | null
  ) {
    if (user !== undefined) state.value.user = user;
    state.value.accessToken = session.access_token;
    state.value.refreshToken = session.refresh_token;
    state.value.expiresAt = session.expires_at ?? null;
    persist();
  }

  /** Set session directly (used by guest join). */
  function setSession(
    user: AuthUser | null,
    session: { access_token: string; refresh_token: string; expires_at?: number }
  ) {
    applySession(session, user);
  }

  async function signup(email: string, password: string, displayName?: string) {
    const res = await $fetch<any>("/api/auth/signup", {
      method: "POST",
      body: { email, password, displayName },
    });
    applySession(res.session, res.user);
  }

  async function login(email: string, password: string) {
    const res = await $fetch<any>("/api/auth/login", {
      method: "POST",
      body: { email, password },
    });
    applySession(res.session, res.user);
  }

  function logout() {
    state.value.user = null;
    state.value.accessToken = null;
    state.value.refreshToken = null;
    state.value.expiresAt = null;
    persist();
    router.push("/");
  }

  // ── Computed ───────────────────────────────────────────

  const isHost = computed(() => !!state.value.user && !state.value.user.isGuest);
  const isGuest = computed(() => !!state.value.user?.isGuest);
  const isLoggedIn = computed(() => !!state.value.user);

  // ── Token refresh ──────────────────────────────────────

  /** True if the access token expires within REFRESH_BUFFER_SECS. */
  function isTokenExpiringSoon(): boolean {
    if (!state.value.expiresAt) return false;
    const nowSecs = Math.floor(Date.now() / 1000);
    return nowSecs >= state.value.expiresAt - REFRESH_BUFFER_SECS;
  }

  let refreshPromise: Promise<void> | null = null;

  /**
   * Refresh the access token using the stored refresh token.
   * Deduplicates concurrent calls (only one in-flight request at a time).
   */
  async function refreshAccessToken(): Promise<void> {
    if (refreshPromise) return refreshPromise;

    refreshPromise = (async () => {
      try {
        const res = await $fetch<any>("/api/auth/refresh", {
          method: "POST",
          body: { refresh_token: state.value.refreshToken },
        });
        applySession(res.session);
      } catch {
        // Refresh failed — session is dead
        logout();
        throw new Error("Session expired — please sign in again");
      } finally {
        refreshPromise = null;
      }
    })();

    return refreshPromise;
  }

  // ── Authenticated fetch ────────────────────────────────

  /**
   * Fetch with auth header. Proactively refreshes expiring tokens
   * and retries once on 401 responses.
   */
  async function authFetch<T>(url: string, opts: any = {}): Promise<T> {
    // Proactive refresh if token is about to expire
    if (isTokenExpiringSoon() && state.value.refreshToken) {
      await refreshAccessToken();
    }

    const doFetch = () =>
      $fetch<T>(url, {
        ...opts,
        headers: {
          ...opts.headers,
          ...(state.value.accessToken
            ? { Authorization: `Bearer ${state.value.accessToken}` }
            : {}),
        },
      });

    try {
      return await doFetch();
    } catch (err: any) {
      // Retry once on 401 if we have a refresh token
      const status = err?.response?.status ?? err?.statusCode;
      if (status === 401 && state.value.refreshToken) {
        await refreshAccessToken();
        return await doFetch();
      }
      throw err;
    }
  }

  return {
    state: state.value,
    restore,
    setSession,
    signup,
    login,
    logout,
    authFetch,
    isHost,
    isGuest,
    isLoggedIn,
  };
}
