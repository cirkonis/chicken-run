/**
 * Composable: all hunt state, data loading, actions, polling, and filtering.
 * Pulls ~300 lines of logic out of pages/hunt/[id].vue.
 */
import type { Hunt, HuntBar, Hint, Participant, Team, HuntExpense, HuntArrival, HuntCheckIn } from "~/types";

const POLL_INTERVAL = 10_000;

export function useHunt(huntId: string) {
  const auth = useAuth();

  // ── State ──────────────────────────────────────────────
  const pageLoading = ref(true);
  const searching = ref(false);
  const syncing = ref(false);
  const error = ref<string | null>(null);

  const hunt = ref<Hunt | null>(null);
  const bars = ref<HuntBar[]>([]);
  const hints = ref<Hint[]>([]);
  const participants = ref<Participant[]>([]);
  const teams = ref<Team[]>([]);
  const expenses = ref<HuntExpense[]>([]);
  const arrivals = ref<HuntArrival[]>([]);
  const checkIns = ref<HuntCheckIn[]>([]);

  // UI state
  const filter = ref("");
  const statusFilter = ref("all");
  const showHintInput = ref(false);
  const newHint = ref("");
  const showWelcomeModal = ref(false);

  // ── Computed ───────────────────────────────────────────
  const isCreator = computed(
    () => hunt.value?.creatorId === auth.state.user?.id
  );

  /** The current user's team (if any) */
  const myTeam = computed(() => {
    const userId = auth.state.user?.id;
    if (!userId) return null;
    const myParticipant = participants.value.find((p) => p.userId === userId);
    if (!myParticipant?.teamId) return null;
    return teams.value.find((t) => t.id === myParticipant.teamId) ?? null;
  });

  /** Pre-registered members on the current user's team */
  const myTeamHunterCount = computed(() => {
    const team = myTeam.value;
    if (!team) return totalHunterCount.value;
    return team.members?.length ?? 0;
  });

  /** Total hunters = all pre-registered members across non-chicken teams */
  const totalHunterCount = computed(() =>
    teams.value
      .filter((t) => !t.isChicken)
      .reduce((sum, t) => sum + (t.members?.length ?? 0), 0)
  );

  const statusCounts = computed(() => {
    let unchecked = 0,
      checked = 0,
      not_checking = 0;
    for (const b of bars.value) {
      if (b.checkStatus === "checked") checked++;
      else if (b.checkStatus === "not_checking") not_checking++;
      else unchecked++;
    }
    return { unchecked, checked, not_checking };
  });

  const filteredBars = computed(() => {
    let result = bars.value;
    const f = filter.value.trim().toLowerCase();
    if (f) {
      result = result.filter((b) =>
        `${b.name} ${b.address}`.toLowerCase().includes(f)
      );
    }
    if (statusFilter.value !== "all") {
      result = result.filter((b) => b.checkStatus === statusFilter.value);
    }
    return result;
  });

  // ── Budget computed ───────────────────────────────────
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

  // ── Callback for map repaint ───────────────────────────
  // Set by the page after creating useMap() so marker repaints are triggered
  let onMarkersChanged: (() => void) | null = null;

  function setOnMarkersChanged(fn: () => void) {
    onMarkersChanged = fn;
  }

  // ── Data loading ───────────────────────────────────────
  async function loadHunt() {
    try {
      const res = await auth.authFetch<any>(`/api/hunts/${huntId}`);
      hunt.value = res.hunt;
      bars.value = res.bars;
      hints.value = res.hints;
      participants.value = res.participants;
      teams.value = res.teams || [];
      expenses.value = res.expenses || [];
      arrivals.value = res.arrivals || [];
      checkIns.value = res.checkIns || [];
      pageLoading.value = false;
    } catch (e: any) {
      error.value = e?.data?.message || e?.message || "Failed to load hunt";
      pageLoading.value = false;
    }
  }

  async function searchBars() {
    if (!hunt.value) return;
    searching.value = true;
    error.value = null;

    try {
      const res = await auth.authFetch<any>(
        `/api/hunts/${huntId}/bars/search`,
        { method: "POST" }
      );
      bars.value = res.bars;
      onMarkersChanged?.();
    } catch (e: any) {
      error.value = e?.data?.message || e?.message || "Search failed";
    } finally {
      searching.value = false;
    }
  }

  async function toggleStatus(bar: HuntBar, target: string) {
    const newStatus = bar.checkStatus === target ? "unchecked" : target;
    const oldStatus = bar.checkStatus;

    // Optimistic update
    bar.checkStatus = newStatus as HuntBar["checkStatus"];
    onMarkersChanged?.();

    try {
      await auth.authFetch(`/api/hunts/${huntId}/bars/${bar.id}`, {
        method: "PATCH",
        body: { checkStatus: newStatus },
      });
    } catch (e: any) {
      // Revert on failure
      bar.checkStatus = oldStatus;
      onMarkersChanged?.();
      error.value =
        e?.data?.message || e?.message || "Failed to update status";
    }
  }

  const hintUploading = ref(false);

  async function addHint(textOverride?: string, imageFile?: File | null) {
    const text = (textOverride ?? newHint.value).trim();
    if (!text && !imageFile) return;

    newHint.value = "";
    showHintInput.value = false;
    hintUploading.value = !!imageFile;

    try {
      // Upload the photo (if any) straight to Storage, then post JSON.
      let imagePath: string | null = null;
      if (imageFile) {
        const { uploadImage } = useMediaUpload();
        imagePath = await uploadImage(huntId, "hints", imageFile);
      }

      const res = await auth.authFetch<any>(`/api/hunts/${huntId}/hints`, {
        method: "POST",
        body: { text, imagePath },
      });

      hints.value.unshift({
        id: res.hint.id,
        text: res.hint.text,
        authorId: res.hint.authorId,
        authorName: auth.state.user?.displayName || "You",
        createdAt: res.hint.createdAt,
        imagePath: res.hint.imagePath || null,
      });
    } catch (e: any) {
      error.value = e?.data?.message || e?.message || "Failed to add hint";
    } finally {
      hintUploading.value = false;
    }
  }

  // ── Check-Ins ──────────────────────────────────────────
  const checkInUploading = ref(false);

  async function checkInBar(barId: string, note: string = "", imageFile?: File | null, withTeamId?: string | null) {
    checkInUploading.value = !!imageFile;

    try {
      // 1. Upload the photo straight to Storage (bytes never touch our server).
      let imagePath: string | null = null;
      if (imageFile) {
        const { uploadImage } = useMediaUpload();
        imagePath = await uploadImage(huntId, "check-ins", imageFile);
      }

      // 2. Record the check-in as plain JSON — just the path + metadata.
      const res = await auth.authFetch<any>(`/api/hunts/${huntId}/bars/${barId}/check-in`, {
        method: "POST",
        body: { imagePath, note, withTeamId: withTeamId || null },
      });

      // Add check-in to local state
      checkIns.value.push(res.checkIn);

      // Update bar status optimistically from the response
      if (res.bar) {
        const idx = bars.value.findIndex((b) => b.id === barId);
        if (idx >= 0) {
          bars.value[idx].checkStatus = res.bar.checkStatus;
          bars.value[idx].checkedBy = res.bar.checkedBy;
          bars.value[idx].checkedAt = res.bar.checkedAt;
          onMarkersChanged?.();
        }
      }
    } catch (e: any) {
      error.value = e?.data?.message || e?.message || "Failed to check in";
      throw e;
    } finally {
      checkInUploading.value = false;
    }
  }

  async function renameTeam(teamId: string, newName: string) {
    try {
      const res = await auth.authFetch<any>(
        `/api/hunts/${huntId}/teams/${teamId}/rename`,
        { method: "POST", body: { name: newName } }
      );
      // Update local teams state
      const idx = teams.value.findIndex((t) => t.id === teamId);
      if (idx >= 0) {
        teams.value[idx] = res.team;
      }
      return res.team;
    } catch (e: any) {
      error.value = e?.data?.message || e?.message || "Failed to rename team";
      throw e;
    }
  }

  async function refreshHunt() {
    syncing.value = true;
    try {
      await loadHunt();
      onMarkersChanged?.();
    } finally {
      syncing.value = false;
    }
  }

  // ── Polling (30s background refresh) ───────────────────
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  async function poll() {
    if (searching.value || syncing.value || !bars.value.length) return;
    try {
      const res = await auth.authFetch<any>(`/api/hunts/${huntId}`);

      // Merge bar status changes
      const barMap = new Map(res.bars.map((b: HuntBar) => [b.id, b]));
      let changed = false;
      for (const b of bars.value) {
        const fresh = barMap.get(b.id);
        if (fresh && fresh.checkStatus !== b.checkStatus) {
          b.checkStatus = fresh.checkStatus;
          b.checkedBy = fresh.checkedBy;
          b.checkedAt = fresh.checkedAt;
          changed = true;
        }
      }
      if (changed) onMarkersChanged?.();

      // Merge hints, participants, teams, expenses, arrivals
      if (res.hints.length !== hints.value.length) {
        hints.value = res.hints;
      }
      participants.value = res.participants;
      teams.value = res.teams || [];
      expenses.value = res.expenses || [];
      arrivals.value = res.arrivals || [];
      checkIns.value = res.checkIns || [];

      // Update hunt (budget might have changed)
      if (res.hunt) {
        hunt.value = res.hunt;
      }
    } catch {
      // Silent — polling failures are non-critical
    }
  }

  // Live feed: realtime push (instant) folded in alongside polling (safety net).
  const realtime = useHuntRealtime(huntId, () => poll());

  function startPolling() {
    pollTimer = setInterval(poll, POLL_INTERVAL);
    realtime.start();
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    realtime.stop();
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
    searching,
    syncing,
    error,
    hunt,
    bars,
    hints,
    participants,
    teams,
    expenses,
    arrivals,
    checkIns,
    filter,
    statusFilter,
    showHintInput,
    newHint,
    hintUploading,
    checkInUploading,
    showWelcomeModal,

    // Computed
    isCreator,
    myTeam,
    myTeamHunterCount,
    totalHunterCount,
    statusCounts,
    filteredBars,
    budgetTotal,
    budgetSpent,
    budgetRemaining,
    budgetPercent,

    // Actions
    loadHunt,
    searchBars,
    toggleStatus,
    addHint,
    checkInBar,
    renameTeam,
    refreshHunt,
    formatTime,
    setOnMarkersChanged,

    // Polling
    startPolling,
    stopPolling,
  };
}
