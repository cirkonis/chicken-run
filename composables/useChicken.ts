/**
 * Composable: chicken (prey) page state, data loading, actions, polling.
 * Wraps the shared hunt data (hunt, hints, participants, teams) and adds
 * chicken-specific state: expenses, arrivals, budget tracking.
 */
import type { Hunt, Hint, Participant, Team, HuntExpense, HuntArrival } from "~/types";

const POLL_INTERVAL = 30_000;

export function useChicken(huntId: string) {
  const auth = useAuth();

  // ── State ──────────────────────────────────────────────
  const pageLoading = ref(true);
  const error = ref<string | null>(null);

  const hunt = ref<Hunt | null>(null);
  const hints = ref<Hint[]>([]);
  const participants = ref<Participant[]>([]);
  const teams = ref<Team[]>([]);
  const expenses = ref<HuntExpense[]>([]);
  const arrivals = ref<HuntArrival[]>([]);

  // UI state
  const showHintInput = ref(false);
  const newHint = ref("");

  // ── Computed ───────────────────────────────────────────
  const isCreator = computed(
    () => hunt.value?.creatorId === auth.state.user?.id
  );

  const budgetTotal = computed(() => hunt.value?.budget ?? null);

  const budgetSpent = computed(() =>
    expenses.value.reduce((sum, e) => sum + e.amount, 0)
  );

  const budgetRemaining = computed(() => {
    if (budgetTotal.value == null) return null;
    return Math.max(0, budgetTotal.value - budgetSpent.value);
  });

  const budgetPercent = computed(() => {
    if (budgetTotal.value == null || budgetTotal.value === 0) return 0;
    return Math.round(
      ((budgetTotal.value - budgetSpent.value) / budgetTotal.value) * 100
    );
  });

  /** Teams that haven't arrived yet */
  const unarrivedTeams = computed(() => {
    const arrivedIds = new Set(arrivals.value.map((a) => a.teamId));
    return teams.value.filter((t) => !t.isChicken && !arrivedIds.has(t.id));
  });

  // ── Data loading ───────────────────────────────────────
  async function loadHunt() {
    try {
      const res = await auth.authFetch<any>(`/api/hunts/${huntId}`);
      hunt.value = res.hunt;
      hints.value = res.hints;
      participants.value = res.participants;
      teams.value = res.teams || [];
      expenses.value = res.expenses || [];
      arrivals.value = res.arrivals || [];
      pageLoading.value = false;
    } catch (e: any) {
      error.value = e?.data?.message || e?.message || "Failed to load hunt";
      pageLoading.value = false;
    }
  }

  // ── Hints ──────────────────────────────────────────────
  async function addHint(textOverride?: string) {
    const text = (textOverride ?? newHint.value).trim();
    if (!text) return;

    newHint.value = "";
    showHintInput.value = false;

    try {
      const res = await auth.authFetch<any>(`/api/hunts/${huntId}/hints`, {
        method: "POST",
        body: { text },
      });
      hints.value.unshift({
        id: res.hint.id,
        text: res.hint.text,
        authorId: res.hint.authorId,
        authorName: auth.state.user?.displayName || "You",
        createdAt: res.hint.createdAt,
      });
    } catch (e: any) {
      error.value = e?.data?.message || e?.message || "Failed to add hint";
    }
  }

  // ── Expenses ───────────────────────────────────────────
  async function addExpense(amount: number, note: string = "") {
    if (amount <= 0) return;
    try {
      const res = await auth.authFetch<any>(`/api/hunts/${huntId}/expenses`, {
        method: "POST",
        body: { amount, note },
      });
      expenses.value.unshift(res.expense);
    } catch (e: any) {
      error.value = e?.data?.message || e?.message || "Failed to add expense";
    }
  }

  async function deleteExpense(expenseId: string) {
    try {
      await auth.authFetch(`/api/hunts/${huntId}/expenses/${expenseId}`, {
        method: "DELETE",
      });
      expenses.value = expenses.value.filter((e) => e.id !== expenseId);
    } catch (e: any) {
      error.value = e?.data?.message || e?.message || "Failed to delete expense";
    }
  }

  // ── Arrivals ───────────────────────────────────────────
  async function addArrival(teamId: string) {
    try {
      const res = await auth.authFetch<any>(`/api/hunts/${huntId}/arrivals`, {
        method: "POST",
        body: { teamId },
      });
      arrivals.value.push(res.arrival);
    } catch (e: any) {
      error.value = e?.data?.message || e?.message || "Failed to record arrival";
    }
  }

  async function deleteArrival(arrivalId: string) {
    try {
      await auth.authFetch(`/api/hunts/${huntId}/arrivals/${arrivalId}`, {
        method: "DELETE",
      });
      arrivals.value = arrivals.value.filter((a) => a.id !== arrivalId);
    } catch (e: any) {
      error.value = e?.data?.message || e?.message || "Failed to delete arrival";
    }
  }

  // ── Polling (30s background refresh) ───────────────────
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  async function poll() {
    try {
      const res = await auth.authFetch<any>(`/api/hunts/${huntId}`);

      // Merge hints
      if (res.hints.length !== hints.value.length) {
        hints.value = res.hints;
      }

      // Merge participants & teams
      participants.value = res.participants;
      teams.value = res.teams || [];

      // Merge expenses & arrivals
      expenses.value = res.expenses || [];
      arrivals.value = res.arrivals || [];

      // Update hunt (budget might have changed)
      if (res.hunt) {
        hunt.value = res.hunt;
      }
    } catch {
      // Silent — polling failures are non-critical
    }
  }

  function startPolling() {
    pollTimer = setInterval(poll, POLL_INTERVAL);
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  // ── Helpers ────────────────────────────────────────────
  function formatTime(iso: string): string {
    try {
      return new Date(iso).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  }

  return {
    // State
    pageLoading,
    error,
    hunt,
    hints,
    participants,
    teams,
    expenses,
    arrivals,
    showHintInput,
    newHint,

    // Computed
    isCreator,
    budgetTotal,
    budgetSpent,
    budgetRemaining,
    budgetPercent,
    unarrivedTeams,

    // Actions
    loadHunt,
    addHint,
    addExpense,
    deleteExpense,
    addArrival,
    deleteArrival,
    formatTime,

    // Polling
    startPolling,
    stopPolling,
  };
}
