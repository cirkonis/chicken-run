// SSR-safe auth state using Nuxt's useState
export function useAuth() {
  const router = useRouter();

  const state = useState<{
    user: null | {
      id: string;
      email?: string;
      displayName: string;
      avatarUrl?: string;
      isGuest?: boolean;
    };
    accessToken: string | null;
    refreshToken: string | null;
    loading: boolean;
  }>("auth", () => ({
    user: null,
    accessToken: null,
    refreshToken: null,
    loading: true,
  }));

  // Restore session from localStorage — call once from onMounted
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
      }
    } catch {
      // corrupt storage, ignore
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
        })
      );
    } else {
      localStorage.removeItem("chickenrun_session");
    }
  }

  // Set session directly (used by guest join)
  function setSession(user: typeof state.value.user, session: { access_token: string; refresh_token: string }) {
    state.value.user = user;
    state.value.accessToken = session.access_token;
    state.value.refreshToken = session.refresh_token;
    persist();
  }

  async function signup(email: string, password: string, displayName?: string) {
    const res = await $fetch<any>("/api/auth/signup", {
      method: "POST",
      body: { email, password, displayName },
    });

    state.value.user = res.user;
    state.value.accessToken = res.session.access_token;
    state.value.refreshToken = res.session.refresh_token;
    persist();
  }

  async function login(email: string, password: string) {
    const res = await $fetch<any>("/api/auth/login", {
      method: "POST",
      body: { email, password },
    });

    state.value.user = res.user;
    state.value.accessToken = res.session.access_token;
    state.value.refreshToken = res.session.refresh_token;
    persist();
  }

  function logout() {
    state.value.user = null;
    state.value.accessToken = null;
    state.value.refreshToken = null;
    persist();
    router.push("/");
  }

  // Is this a real host account (not a guest)?
  const isHost = computed(() => !!state.value.user && !state.value.user.isGuest);
  const isGuest = computed(() => !!state.value.user?.isGuest);
  const isLoggedIn = computed(() => !!state.value.user);

  // Helper: fetch with auth header
  function authFetch<T>(url: string, opts: any = {}): Promise<T> {
    return $fetch<T>(url, {
      ...opts,
      headers: {
        ...opts.headers,
        ...(state.value.accessToken
          ? { Authorization: `Bearer ${state.value.accessToken}` }
          : {}),
      },
    });
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
