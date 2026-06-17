/**
 * Apollo Client → Supabase pg_graphql
 *
 * `.client.ts` = Nuxt runs this only in the browser. That's intentional: our
 * session token lives client-side (localStorage, via useAuth), so the GraphQL
 * client and its cache belong in the browser too.
 *
 * What this gives us:
 *   • A single ApolloClient pointed at Supabase's auto-generated GraphQL API
 *     (`/graphql/v1`, served by the pg_graphql extension).
 *   • A normalized in-memory cache — this is the "state management" we're moving
 *     to: query results are stored by type + id and shared across components,
 *     instead of each composable hand-rolling refs.
 *   • Auth that reuses the EXACT token useAuth already manages, so GraphQL
 *     requests run as the right user and hit the same RLS policies as REST.
 *
 * Supabase requires two headers on every GraphQL request:
 *   • apikey:        the project's anon/publishable key (identifies the project)
 *   • Authorization: `Bearer <jwt>` — the signed-in user's token, or the anon
 *                    key when nobody is signed in (anonymous access).
 */
import {
  ApolloClient,
  InMemoryCache,
  createHttpLink,
  from,
  fromPromise,
} from "@apollo/client/core";
import { setContext } from "@apollo/client/link/context";
import { onError } from "@apollo/client/link/error";
import { provideApolloClient, DefaultApolloClient } from "@vue/apollo-composable";

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig();
  const supabaseUrl = config.public.supabaseUrl;
  const anonKey = config.public.supabaseAnonKey;

  // useAuth is our single source of truth for the session. We grab the composable
  // once here, but READ the token lazily inside each link (below) so that token
  // refreshes are always picked up — never cache the token itself.
  const auth = useAuth();

  // ── Link 1: HTTP transport ────────────────────────────────────────────────
  // Where requests go. pg_graphql lives at <project>/graphql/v1.
  const httpLink = createHttpLink({ uri: `${supabaseUrl}/graphql/v1` });

  // ── Link 2: Auth headers ──────────────────────────────────────────────────
  // Runs before every request. Proactively refreshes a near-expired token first
  // (mirrors authFetch), then attaches the apikey + Authorization headers.
  const authLink = setContext(async (_operation, { headers }) => {
    if (auth.isTokenExpiringSoon() && auth.state.refreshToken) {
      // If this throws, we fall through with the old token; Link 3 handles the 401.
      try {
        await auth.refreshAccessToken();
      } catch {
        /* handled by errorLink */
      }
    }
    const token = auth.state.accessToken || anonKey;
    return {
      headers: {
        ...headers,
        apikey: anonKey,
        Authorization: `Bearer ${token}`,
      },
    };
  });

  // ── Link 3: Refresh-and-retry on auth failure ─────────────────────────────
  // If a request still fails because the JWT expired (e.g. the app was
  // backgrounded for hours — the "session dies mid-hunt" bug), refresh once and
  // replay the request. The `retried` flag prevents an infinite loop, and once
  // useAuth gives up it clears the refresh token so we stop trying.
  const errorLink = onError(({ graphQLErrors, networkError, operation, forward }) => {
    const isAuthError =
      (networkError as any)?.statusCode === 401 ||
      !!graphQLErrors?.some((e) => /jwt|expired/i.test(e.message));

    const alreadyRetried = operation.getContext().retried;

    if (isAuthError && !alreadyRetried && auth.state.refreshToken) {
      operation.setContext({ retried: true });
      return fromPromise(
        auth.refreshAccessToken().catch(() => {
          /* swallow — the replayed request will simply fail if refresh failed */
        })
      ).flatMap(() => forward(operation));
    }
  });

  // ── The client ────────────────────────────────────────────────────────────
  // Links execute in array order on the way out: errors caught → auth added →
  // sent over HTTP.
  const apollo = new ApolloClient({
    link: from([errorLink, authLink, httpLink]),
    cache: new InMemoryCache(),
  });

  // Expose it two ways:
  //   • provideApolloClient(): lets @vue/apollo-composable's useQuery/useMutation
  //     find the client even when called outside a component setup().
  //   • vueApp.provide(DefaultApolloClient): the inject key useQuery reads inside
  //     components.
  //   • nuxtApp.provide('apollo'): imperative access via useNuxtApp().$apollo for
  //     one-off client.query() calls.
  provideApolloClient(apollo);
  nuxtApp.vueApp.provide(DefaultApolloClient, apollo);

  return { provide: { apollo } };
});
