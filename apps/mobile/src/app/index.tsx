import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform as RNPlatform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import {
  connectObs,
  createSession,
  disconnectObs,
  endSession,
  getDashboard,
  getObsScenes,
  getObsStatus,
  getObsStreamStatus,
  setObsScene,
  startObsStream,
  startSession,
  stopObsStream,
  type DashboardData,
  type DashboardEvent,
  type ObsScene,
  type ObsStatus,
  type ObsStreamStatus,
  type Platform,
} from "../lib/api";

import { connectSocket, disconnectSocket, socket } from "../lib/socket";
import { useAuth } from "../lib/auth-context";

const PLATFORMS: Platform[] = ["youtube", "tiktok", "twitch", "kick"];
type Tab = "home" | "activity" | "studio" | "profile";
type IconName = keyof typeof Ionicons.glyphMap;

const C = {
  bg: "#0e1013",
  surface: "#171a1f",
  raised: "#1f232a",
  border: "#262b33",
  borderStrong: "#343a45",
  text: "#f2f3f5",
  muted: "#9aa1ad",
  subtle: "#6b7280",
  green: "#3ddc84",
  greenSoft: "#11271b",
  orange: "#ff9145",
  blue: "#4aa3ff",
  red: "#ff5d6c",
  redSoft: "#2b1519",
};

function platformLabel(platform: string) {
  const labels: Record<string, string> = {
    youtube: "YouTube",
    tiktok: "TikTok",
    twitch: "Twitch",
    kick: "Kick",
  };
  return labels[platform] ?? platform;
}

function eventLabel(type: string) {
  const labels: Record<string, string> = {
    chat: "Chat",
    donation: "Donasi",
    follow: "Follow",
    subscribe: "Subscribe",
    member: "Member",
    raid: "Raid",
    system: "Sistem",
  };
  return labels[type] ?? type.charAt(0).toUpperCase() + type.slice(1);
}

function sessionStatusLabel(status: string) {
  const labels: Record<string, string> = {
    live: "Sedang berjalan",
    ended: "Selesai",
  };
  return labels[status] ?? status;
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatToday() {
  return new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function getPlatformMark(platform: string) {
  const marks: Record<string, string> = {
    youtube: "YT",
    tiktok: "TT",
    twitch: "TW",
    kick: "K",
  };
  return marks[platform] ?? platform.slice(0, 2).toUpperCase();
}

function getInitial(username: string) {
  return username.trim().charAt(0).toUpperCase() || "?";
}

function TabButton({
  label,
  icon,
  activeIcon,
  selected,
  onPress,
}: {
  label: string;
  icon: IconName;
  activeIcon: IconName;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={styles.tabButton}
    >
      <Ionicons
        name={selected ? activeIcon : icon}
        size={24}
        color={selected ? C.green : C.subtle}
      />
      <Text style={[styles.tabLabel, selected && styles.tabLabelSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function Index() {
  const { user, logout } = useAuth();

  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [socketConnected, setSocketConnected] = useState(socket.connected);
  const [error, setError] = useState<string | null>(null);

  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([
    "youtube",
    "tiktok",
  ]);

  const [obsStatus, setObsStatus] = useState<ObsStatus | null>(null);
  const [obsScenes, setObsScenes] = useState<ObsScene[]>([]);
  const [obsLoading, setObsLoading] = useState(false);
  const [obsConnecting, setObsConnecting] = useState(false);
  const [obsDisconnecting, setObsDisconnecting] = useState(false);
  const [changingScene, setChangingScene] = useState<string | null>(null);
  const [obsError, setObsError] = useState<string | null>(null);
  const [obsStreamStatus, setObsStreamStatus] =
    useState<ObsStreamStatus | null>(null);
  const [obsStreamActionLoading, setObsStreamActionLoading] = useState(false);
  const [obsStreamError, setObsStreamError] = useState<string | null>(null);

  const loadDashboard = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      setError(null);
      const data = await getDashboard();

      setDashboard((current) => {
        if (!current) return data;

        const fetchedIds = new Set(data.events.recent.map((event) => event.id));
        const incoming = current.events.recent.filter(
          (event) => !fetchedIds.has(event.id),
        );

        return {
          ...data,
          events: {
            total: Math.max(data.events.total, current.events.total),
            recent: [...incoming, ...data.events.recent].slice(0, 20),
          },
        };
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal mengambil dashboard.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadObs = useCallback(async () => {
    try {
      setObsLoading(true);
      setObsError(null);
      const status = await getObsStatus();
      setObsStatus(status);

      if (!status.connected) {
        setObsScenes([]);
        setObsStreamStatus(null);
        return;
      }

      const result = await getObsScenes();
      setObsScenes(result.scenes);
      setObsStatus((current) =>
        current ? { ...current, currentScene: result.currentScene } : current,
      );

      try {
        setObsStreamStatus(await getObsStreamStatus());
        setObsStreamError(null);
      } catch (err) {
        setObsStreamError(
          err instanceof Error
            ? err.message
            : "Gagal mengambil status streaming OBS.",
        );
      }
    } catch (err) {
      setObsStatus(null);
      setObsScenes([]);
      setObsStreamStatus(null);
      setObsError(
        err instanceof Error ? err.message : "Gagal mengambil status OBS.",
      );
    } finally {
      setObsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
    void loadObs();

    const onConnect = () => setSocketConnected(true);
    const onDisconnect = () => setSocketConnected(false);

    function onStreamEvent(event: DashboardEvent) {
      setDashboard((current) => {
        const existing = current?.events.recent ?? [];
        if (existing.some((item) => item.id === event.id)) return current;

        if (!current) {
          return {
            session: null,
            events: { total: 1, recent: [event] },
          } as DashboardData;
        }

        return {
          ...current,
          events: {
            total: current.events.total + 1,
            recent: [event, ...existing].slice(0, 20),
          },
        };
      });
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("stream:event", onStreamEvent);
    void connectSocket();

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("stream:event", onStreamEvent);
      disconnectSocket();
    };
  }, [loadDashboard, loadObs]);

  function navigateTab(tab: Tab) {
    if (tab === "profile") {
      router.push("/account");
      return;
    }
    setActiveTab(tab);
  }

  function togglePlatform(platform: Platform) {
    setSelectedPlatforms((current) =>
      current.includes(platform)
        ? current.filter((item) => item !== platform)
        : [...current, platform],
    );
  }

  async function handleStartStream() {
    if (selectedPlatforms.length === 0) {
      Alert.alert("Pilih platform", "Pilih minimal satu platform terlebih dahulu.");
      return;
    }

    try {
      setSessionLoading(true);
      setError(null);

      let session = dashboard?.session;
      if (!session || session.status === "ended") {
        session = await createSession(selectedPlatforms);
      }

      const started = await startSession(session.id);
      setDashboard((current) =>
        current ? { ...current, session: started } : current,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memulai sesi.");
    } finally {
      setSessionLoading(false);
    }
  }

  async function handleEndStream() {
    const session = dashboard?.session;
    if (!session) return;

    try {
      setSessionLoading(true);
      setError(null);
      const ended = await endSession(session.id);
      setDashboard((current) =>
        current ? { ...current, session: ended } : current,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengakhiri sesi.");
    } finally {
      setSessionLoading(false);
    }
  }

  async function handleConnectObs() {
    try {
      setObsConnecting(true);
      setObsError(null);
      await connectObs();
      await loadObs();
    } catch (err) {
      setObsError(
        err instanceof Error ? err.message : "Gagal menghubungkan OBS.",
      );
    } finally {
      setObsConnecting(false);
    }
  }

  async function handleDisconnectObs() {
    try {
      setObsDisconnecting(true);
      await disconnectObs();
      setObsStatus(null);
      setObsScenes([]);
      setObsStreamStatus(null);
      setObsError(null);
    } catch (err) {
      setObsError(err instanceof Error ? err.message : "Gagal memutuskan OBS.");
    } finally {
      setObsDisconnecting(false);
    }
  }

  async function handleChangeScene(scene: ObsScene) {
    if (
      !obsStatus?.connected ||
      changingScene !== null ||
      scene.name === obsStatus.currentScene
    ) {
      return;
    }

    try {
      setChangingScene(scene.name);
      setObsError(null);
      const result = await setObsScene(scene.name);
      if (!result.success) {
        throw new Error(result.message ?? "Gagal mengganti scene.");
      }
      await loadObs();
    } catch (err) {
      setObsError(
        err instanceof Error ? err.message : "Gagal mengganti scene OBS.",
      );
    } finally {
      setChangingScene(null);
    }
  }

  async function handleObsStreamAction(action: "start" | "stop") {
    if (!obsStatus?.connected || obsStreamActionLoading) return;

    try {
      setObsStreamActionLoading(true);
      setObsStreamError(null);

      if (action === "start") await startObsStream();
      else await stopObsStream();

      const status = await getObsStreamStatus();
      setObsStreamStatus(status);
      setObsStatus(await getObsStatus());

      if (status.streaming !== (action === "start")) {
        throw new Error("Status streaming OBS belum sesuai dengan aksi.");
      }

      Alert.alert(
        action === "start" ? "Streaming dimulai" : "Streaming dihentikan",
        action === "start"
          ? "OBS mengonfirmasi streaming sedang aktif."
          : "OBS mengonfirmasi streaming sudah berhenti.",
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Aksi streaming OBS gagal.";
      setObsStreamError(message);
      Alert.alert("Streaming OBS", message);
      try {
        setObsStreamStatus(await getObsStreamStatus());
      } catch {
        // Pertahankan pesan error utama.
      }
    } finally {
      setObsStreamActionLoading(false);
    }
  }

  function handleLogout() {
    Alert.alert("Keluar dari Kiln", "Kamu yakin ingin keluar?", [
      { text: "Batal", style: "cancel" },
      {
        text: "Keluar",
        style: "destructive",
        onPress: () => void performLogout(),
      },
    ]);
  }

  async function performLogout() {
    try {
      setLoggingOut(true);
      disconnectSocket();
      await logout();
    } catch (err) {
      console.error("Gagal logout:", err);
    } finally {
      setLoggingOut(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <Text style={styles.brand}>Kiln</Text>
        <ActivityIndicator color={C.green} size="large" />
        <Text style={styles.mutedText}>Menyiapkan dashboard...</Text>
      </View>
    );
  }

  const session = dashboard?.session;
  const isLive = session?.status === "live";
  const hasActiveSession = !!session && session.status !== "ended";
  const obsConnected = obsStatus?.connected === true;
  const obsStreaming = obsStreamStatus?.streaming === true;
  const events = dashboard?.events.recent ?? [];
  const displayName = user?.email?.split("@")[0] ?? "Kreator";

  return (
    <View style={styles.app}>
      <ScrollView
        key={activeTab}
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={C.green}
            onRefresh={() => {
              void loadDashboard(true);
              void loadObs();
            }}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarLargeText}>{getInitial(displayName)}</Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.greeting} numberOfLines={1}>
              Halo, {displayName}
            </Text>
            <Text style={styles.mutedText}>{formatToday()}</Text>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.headerButton,
              pressed && styles.pressed,
            ]}
            onPress={handleLogout}
          >
            {loggingOut ? (
              <ActivityIndicator size="small" color={C.muted} />
            ) : (
              <Ionicons name="log-out-outline" size={20} color={C.muted} />
            )}
          </Pressable>
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>Koneksi bermasalah</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* ============ HOME ============ */}
        {activeTab === "home" && (
          <>
            <Section title="Status siaran">
              <View style={styles.card}>
                <View style={styles.heroRow}>
                  <View
                    style={[
                      styles.ring,
                      { borderColor: isLive ? C.red : C.borderStrong },
                    ]}
                  >
                    <Ionicons
                      name={isLive ? "radio" : "radio-outline"}
                      size={30}
                      color={isLive ? C.red : C.subtle}
                    />
                  </View>

                  <View style={styles.heroInfo}>
                    <Text style={styles.heroTitle}>
                      {isLive ? "Sedang live" : "Belum siaran"}
                    </Text>
                    <Text style={styles.mutedText}>
                      {isLive && session?.startedAt
                        ? `Sejak pukul ${formatTime(session.startedAt)}`
                        : "Mulai sesi untuk tampil di platform"}
                    </Text>
                  </View>
                </View>

                <View style={styles.divider} />

                <StatusLine
                  label="Realtime"
                  value={socketConnected ? "Terhubung" : "Terputus"}
                  color={socketConnected ? C.green : C.red}
                />
                <StatusLine
                  label="OBS Studio"
                  value={obsConnected ? "Terhubung" : "Belum terhubung"}
                  color={obsConnected ? C.green : C.subtle}
                />
              </View>
            </Section>

            <Section
              title="Sesi siaran"
              hint={session ? sessionStatusLabel(session.status) : undefined}
            >
              <View style={styles.card}>
                {session ? (
                  <View style={styles.chipWrap}>
                    {session.platforms.map((platform) => (
                      <View key={platform} style={styles.chipStatic}>
                        <Text style={styles.chipStaticText}>
                          {platformLabel(platform)}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.bodyText}>
                    Belum ada sesi. Pilih platform lalu mulai siaran.
                  </Text>
                )}

                {session?.startedAt && !isLive && (
                  <Text style={styles.mutedText}>
                    Dimulai pukul {formatTime(session.startedAt)}
                  </Text>
                )}

                {!hasActiveSession && (
                  <View style={styles.pickerBlock}>
                    <Text style={styles.fieldLabel}>Siaran ke</Text>
                    <View style={styles.chipWrap}>
                      {PLATFORMS.map((platform) => {
                        const selected = selectedPlatforms.includes(platform);
                        return (
                          <Pressable
                            key={platform}
                            onPress={() => togglePlatform(platform)}
                            style={[
                              styles.chip,
                              selected && styles.chipSelected,
                            ]}
                          >
                            <Ionicons
                              name={selected ? "checkmark-circle" : "add-circle-outline"}
                              size={16}
                              color={selected ? C.green : C.subtle}
                            />
                            <Text
                              style={[
                                styles.chipText,
                                selected && styles.chipTextSelected,
                              ]}
                            >
                              {platformLabel(platform)}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                )}

                <Pressable
                  disabled={
                    sessionLoading ||
                    (!isLive &&
                      !hasActiveSession &&
                      selectedPlatforms.length === 0)
                  }
                  onPress={() =>
                    isLive ? void handleEndStream() : void handleStartStream()
                  }
                  style={({ pressed }) => [
                    isLive ? styles.dangerButton : styles.primaryButton,
                    pressed && styles.pressed,
                    (sessionLoading ||
                      (!isLive &&
                        !hasActiveSession &&
                        selectedPlatforms.length === 0)) &&
                      styles.disabled,
                  ]}
                >
                  {sessionLoading ? (
                    <ActivityIndicator color={isLive ? C.red : C.bg} />
                  ) : (
                    <Text
                      style={isLive ? styles.dangerButtonText : styles.primaryButtonText}
                    >
                      {isLive
                        ? "Akhiri sesi siaran"
                        : hasActiveSession
                          ? "Mulai sesi lagi"
                          : "Mulai sesi siaran"}
                    </Text>
                  )}
                </Pressable>
              </View>
            </Section>

            <Section title="Ringkasan">
              <View style={styles.statGrid}>
                <StatTile
                  label="Total event"
                  value={String(dashboard?.events.total ?? 0)}
                  color={C.text}
                />
                <StatTile
                  label="Realtime"
                  value={socketConnected ? "Aktif" : "Mati"}
                  color={socketConnected ? C.green : C.red}
                />
                <StatTile
                  label="OBS"
                  value={obsConnected ? (obsStreaming ? "Live" : "Siap") : "Off"}
                  color={
                    obsConnected ? (obsStreaming ? C.red : C.blue) : C.subtle
                  }
                />
              </View>
            </Section>

            <Section
              title="Aktivitas terbaru"
              action="Lihat semua"
              onAction={() => setActiveTab("activity")}
            >
              <View style={styles.card}>
                {events.length ? (
                  events
                    .slice(0, 3)
                    .map((event, index, list) => (
                      <EventRow
                        key={event.id}
                        event={event}
                        last={index === list.length - 1}
                      />
                    ))
                ) : (
                  <EmptyState
                    title="Belum ada aktivitas"
                    description="Chat, donasi, dan follow akan muncul di sini saat kamu siaran."
                  />
                )}
              </View>
            </Section>

            <Section title="Studio remote">
              <Pressable
                onPress={() => setActiveTab("studio")}
                style={({ pressed }) => [
                  styles.card,
                  styles.linkCard,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.iconBox}>
                  <Ionicons name="videocam-outline" size={22} color={C.blue} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.cardTitle}>OBS Studio</Text>
                  <Text style={styles.mutedText}>
                    {obsConnected
                      ? "Terhubung, kelola scene dan siaran"
                      : "Hubungkan untuk mengontrol scene"}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={C.subtle} />
              </Pressable>
            </Section>
            <Section title="Overlay OBS">
              <Pressable
                onPress={() => router.push("/overlay")}
                style={({ pressed }) => [
                  styles.card,
                  styles.linkCard,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.iconBox}>
                  <Ionicons
                    name="layers-outline"
                    size={22}
                    color={C.green}
                  />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.cardTitle}>Kelola Overlay</Text>
                  <Text style={styles.mutedText}>
                    Buat token dan siapkan URL untuk OBS Browser Source
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={C.subtle}
                />
              </Pressable>
            </Section>

          </>
        )}

        {/* ============ AKTIVITAS ============ */}
        {activeTab === "activity" && (
          <>
            <Section title="Ringkasan">
              <View style={styles.statGrid}>
                <StatTile
                  label="Total event"
                  value={String(dashboard?.events.total ?? 0)}
                  color={C.text}
                />
                <StatTile
                  label="Koneksi feed"
                  value={socketConnected ? "Aktif" : "Mati"}
                  color={socketConnected ? C.green : C.red}
                />
              </View>
            </Section>

            <Section
              title="Live feed"
              hint={socketConnected ? "Realtime" : "Terputus"}
            >
              <View style={styles.card}>
                {events.length ? (
                  events.map((event, index) => (
                    <EventRow
                      key={event.id}
                      event={event}
                      last={index === events.length - 1}
                    />
                  ))
                ) : (
                  <EmptyState
                    title="Menunggu aktivitas"
                    description="Komentar, donasi, follow, dan event lain akan muncul di sini saat diterima backend."
                  />
                )}
              </View>
            </Section>
          </>
        )}

        {/* ============ STUDIO ============ */}
        {activeTab === "studio" && (
          <>
            <Section
              title="Koneksi OBS"
              hint={obsConnected ? "Terhubung" : "Belum terhubung"}
            >
              <View style={styles.card}>
                <View style={styles.rowBetween}>
                  <View style={styles.flex}>
                    <Text style={styles.cardTitle}>OBS Studio</Text>
                    <Text style={styles.mutedText}>
                      {obsConnected
                        ? `Versi ${obsStatus?.obsVersion ?? "-"}`
                        : "Hubungkan untuk mengontrol studio dari sini."}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.dotLarge,
                      { backgroundColor: obsConnected ? C.green : C.subtle },
                    ]}
                  />
                </View>

                {obsError && <Text style={styles.inlineError}>{obsError}</Text>}

                {!obsConnected && (
                  <Pressable
                    disabled={obsConnecting}
                    onPress={() => void handleConnectObs()}
                    style={({ pressed }) => [
                      styles.primaryButton,
                      pressed && styles.pressed,
                      obsConnecting && styles.disabled,
                    ]}
                  >
                    {obsConnecting ? (
                      <ActivityIndicator color={C.bg} />
                    ) : (
                      <Text style={styles.primaryButtonText}>Hubungkan OBS</Text>
                    )}
                  </Pressable>
                )}
              </View>
            </Section>

            {obsConnected && (
              <>
                <Section title="Siaran OBS" hint="Terpisah dari sesi Kiln">
                  <View style={styles.card}>
                    <View style={styles.statGrid}>
                      <StatTile
                        label="Streaming"
                        value={obsStreaming ? "Live" : "Off"}
                        color={obsStreaming ? C.red : C.text}
                        inner
                      />
                      <StatTile
                        label="Recording"
                        value={obsStatus?.recording ? "On" : "Off"}
                        color={obsStatus?.recording ? C.green : C.text}
                        inner
                      />
                    </View>

                    {obsStreamError && (
                      <Text style={styles.inlineError}>{obsStreamError}</Text>
                    )}

                    <Pressable
                      disabled={obsStreamActionLoading || obsStreamStatus === null}
                      onPress={() =>
                        void handleObsStreamAction(obsStreaming ? "stop" : "start")
                      }
                      style={({ pressed }) => [
                        obsStreaming ? styles.dangerButton : styles.secondaryButton,
                        pressed && styles.pressed,
                        (obsStreamActionLoading || obsStreamStatus === null) &&
                          styles.disabled,
                      ]}
                    >
                      {obsStreamActionLoading ? (
                        <ActivityIndicator color={obsStreaming ? C.red : C.text} />
                      ) : (
                        <Text
                          style={
                            obsStreaming
                              ? styles.dangerButtonText
                              : styles.secondaryButtonText
                          }
                        >
                          {obsStreaming
                            ? "Hentikan streaming OBS"
                            : "Mulai streaming OBS"}
                        </Text>
                      )}
                    </Pressable>
                  </View>
                </Section>

                <Section
                  title="Scene"
                  action="Segarkan"
                  actionLoading={obsLoading}
                  onAction={() => void loadObs()}
                >
                  <View style={styles.card}>
                    <View>
                      <Text style={styles.fieldLabel}>Scene aktif</Text>
                      <Text style={styles.currentScene} numberOfLines={1}>
                        {obsStatus?.currentScene ?? "Belum ada scene aktif"}
                      </Text>
                    </View>

                    <View style={styles.divider} />

                    {obsScenes.length === 0 && (
                      <Text style={styles.mutedText}>
                        Tidak ada scene yang tersedia di OBS.
                      </Text>
                    )}

                    {obsScenes.map((scene) => {
                      const active = scene.name === obsStatus?.currentScene;
                      const changing = changingScene === scene.name;

                      return (
                        <Pressable
                          key={`${scene.index}-${scene.name}`}
                          disabled={active || changingScene !== null || obsLoading}
                          onPress={() => void handleChangeScene(scene)}
                          style={({ pressed }) => [
                            styles.sceneRow,
                            active && styles.sceneRowActive,
                            pressed && !active && styles.pressed,
                          ]}
                        >
                          <View style={styles.sceneIndexBox}>
                            <Text style={styles.sceneIndex}>
                              {scene.index + 1}
                            </Text>
                          </View>
                          <Text style={styles.sceneName} numberOfLines={1}>
                            {scene.name}
                          </Text>
                          {changing ? (
                            <ActivityIndicator size="small" color={C.green} />
                          ) : active ? (
                            <Text style={styles.sceneActive}>Aktif</Text>
                          ) : (
                            <Text style={styles.sceneAction}>Pilih</Text>
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                </Section>

                <Pressable
                  onPress={() =>
                    Alert.alert(
                      "Putuskan OBS?",
                      "Siaran yang sedang berjalan tidak akan dihentikan.",
                      [
                        { text: "Batal", style: "cancel" },
                        {
                          text: "Putuskan",
                          style: "destructive",
                          onPress: () => void handleDisconnectObs(),
                        },
                      ],
                    )
                  }
                  disabled={obsDisconnecting || changingScene !== null}
                  style={({ pressed }) => [
                    styles.dangerButton,
                    pressed && styles.pressed,
                    (obsDisconnecting || changingScene !== null) &&
                      styles.disabled,
                  ]}
                >
                  {obsDisconnecting ? (
                    <ActivityIndicator color={C.red} />
                  ) : (
                    <Text style={styles.dangerButtonText}>
                      Putuskan koneksi OBS
                    </Text>
                  )}
                </Pressable>
              </>
            )}
          </>
        )}
      </ScrollView>

      <View style={styles.bottomBar}>
        <TabButton
          label="Beranda"
          icon="home-outline"
          activeIcon="home"
          selected={activeTab === "home"}
          onPress={() => navigateTab("home")}
        />
        <TabButton
          label="Aktivitas"
          icon="pulse-outline"
          activeIcon="pulse"
          selected={activeTab === "activity"}
          onPress={() => navigateTab("activity")}
        />
        <TabButton
          label="Studio"
          icon="videocam-outline"
          activeIcon="videocam"
          selected={activeTab === "studio"}
          onPress={() => navigateTab("studio")}
        />
        <TabButton
          label="Profil"
          icon="person-outline"
          activeIcon="person"
          selected={false}
          onPress={() => navigateTab("profile")}
        />
      </View>
    </View>
  );
}

function Section({
  title,
  hint,
  action,
  actionLoading,
  onAction,
  children,
}: {
  title: string;
  hint?: string;
  action?: string;
  actionLoading?: boolean;
  onAction?: () => void;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {action ? (
          <Pressable onPress={onAction} hitSlop={10} disabled={actionLoading}>
            {actionLoading ? (
              <ActivityIndicator size="small" color={C.green} />
            ) : (
              <Text style={styles.sectionAction}>{action}</Text>
            )}
          </Pressable>
        ) : hint ? (
          <Text style={styles.sectionHint}>{hint}</Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function StatusLine({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View style={styles.statusLine}>
      <Text style={styles.statusLineLabel}>{label}</Text>
      <View style={styles.statusLineValue}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={styles.statusLineText}>{value}</Text>
      </View>
    </View>
  );
}

function StatTile({
  label,
  value,
  color,
  inner,
}: {
  label: string;
  value: string;
  color: string;
  inner?: boolean;
}) {
  return (
    <View style={[styles.statTile, inner && styles.statTileInner]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function EventRow({
  event,
  last,
}: {
  event: DashboardEvent;
  last: boolean;
}) {
  const tone =
    event.type === "donation"
      ? C.orange
      : event.type === "follow" || event.type === "subscribe"
        ? C.green
        : C.blue;

  return (
    <View style={[styles.eventRow, !last && styles.eventDivider]}>
      <View style={[styles.eventAvatar, { borderColor: tone }]}>
        <Text style={[styles.eventAvatarText, { color: tone }]}>
          {getInitial(event.username)}
        </Text>
      </View>

      <View style={styles.eventContent}>
        <View style={styles.rowBetween}>
          <Text style={styles.eventUsername} numberOfLines={1}>
            {event.username}
          </Text>
          <Text style={styles.eventTime}>{formatTime(event.timestamp)}</Text>
        </View>

        <Text style={styles.eventMessage}>
          {event.message ?? eventLabel(event.type)}
        </Text>

        {event.amount != null && (
          <Text style={styles.eventAmount}>
            {event.currency ?? ""} {event.amount}
          </Text>
        )}

        <View style={styles.eventFooter}>
          <View style={styles.platformTag}>
            <Text style={styles.platformTagMark}>
              {getPlatformMark(event.platform)}
            </Text>
            <Text style={styles.platformTagText}>
              {platformLabel(event.platform)}
            </Text>
          </View>
          <Text style={[styles.eventType, { color: tone }]}>
            {eventLabel(event.type)}
          </Text>
        </View>
      </View>
    </View>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <View style={styles.emptyState}>
      <Ionicons name="chatbubbles-outline" size={30} color={C.subtle} />
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.emptyDescription}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
    backgroundColor: C.bg,
  },
  screen: {
    flex: 1,
    backgroundColor: C.bg,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 26,
    paddingBottom: 36,
    gap: 30,
  },
  flex: {
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.45,
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: C.bg,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  brand: {
    color: C.text,
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.5,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatarLarge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: C.raised,
    borderWidth: 2,
    borderColor: C.green,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLargeText: {
    color: C.text,
    fontSize: 20,
    fontWeight: "700",
  },
  headerInfo: {
    flex: 1,
    gap: 2,
  },
  greeting: {
    color: C.text,
    fontSize: 22,
    fontWeight: "700",
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },

  // Section
  section: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionTitle: {
    color: C.text,
    fontSize: 20,
    fontWeight: "700",
  },
  sectionHint: {
    color: C.subtle,
    fontSize: 14,
  },
  sectionAction: {
    color: C.green,
    fontSize: 14,
    fontWeight: "600",
  },

  // Card
  card: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 22,
    padding: 18,
    gap: 16,
  },
  cardTitle: {
    color: C.text,
    fontSize: 16,
    fontWeight: "700",
  },
  bodyText: {
    color: C.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  mutedText: {
    color: C.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  divider: {
    height: 1,
    backgroundColor: C.border,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  // Hero
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
  },
  ring: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  heroInfo: {
    flex: 1,
    gap: 4,
  },
  heroTitle: {
    color: C.text,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  statusLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusLineLabel: {
    color: C.muted,
    fontSize: 14,
  },
  statusLineValue: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusLineText: {
    color: C.text,
    fontSize: 14,
    fontWeight: "600",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotLarge: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },

  // Session
  fieldLabel: {
    color: C.subtle,
    fontSize: 13,
    fontWeight: "600",
  },
  pickerBlock: {
    gap: 10,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderWidth: 1,
    borderColor: C.borderStrong,
    backgroundColor: C.bg,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  chipSelected: {
    backgroundColor: C.greenSoft,
    borderColor: C.green,
  },
  chipText: {
    color: C.muted,
    fontSize: 14,
    fontWeight: "600",
  },
  chipTextSelected: {
    color: C.green,
  },
  chipStatic: {
    backgroundColor: C.raised,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipStaticText: {
    color: C.text,
    fontSize: 14,
    fontWeight: "600",
  },

  // Tombol
  primaryButton: {
    minHeight: 52,
    backgroundColor: C.green,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  primaryButtonText: {
    color: C.bg,
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryButton: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.borderStrong,
    backgroundColor: C.raised,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  secondaryButtonText: {
    color: C.text,
    fontSize: 15,
    fontWeight: "600",
  },
  dangerButton: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#5c2e35",
    backgroundColor: C.redSoft,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  dangerButtonText: {
    color: C.red,
    fontSize: 15,
    fontWeight: "600",
  },

  // Stat
  statGrid: {
    flexDirection: "row",
    gap: 12,
  },
  statTile: {
    flex: 1,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 18,
    padding: 16,
    gap: 4,
  },
  statTileInner: {
    backgroundColor: C.raised,
    borderColor: C.raised,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "800",
  },
  statLabel: {
    color: C.muted,
    fontSize: 13,
  },

  // Link card
  linkCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: C.raised,
    alignItems: "center",
    justifyContent: "center",
  },

  // Error
  errorBox: {
    backgroundColor: C.redSoft,
    borderWidth: 1,
    borderColor: "#5c2e35",
    borderRadius: 16,
    padding: 16,
    gap: 4,
  },
  errorTitle: {
    color: C.red,
    fontSize: 15,
    fontWeight: "700",
  },
  errorText: {
    color: "#f0b4ba",
    fontSize: 14,
    lineHeight: 20,
  },
  inlineError: {
    color: C.red,
    fontSize: 14,
    lineHeight: 20,
  },

  // Scene
  currentScene: {
    color: C.text,
    fontSize: 22,
    fontWeight: "700",
    marginTop: 4,
  },
  sceneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 54,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "transparent",
  },
  sceneRowActive: {
    backgroundColor: C.greenSoft,
    borderColor: "#1f5a3a",
  },
  sceneIndexBox: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: C.raised,
    alignItems: "center",
    justifyContent: "center",
  },
  sceneIndex: {
    color: C.muted,
    fontSize: 13,
    fontWeight: "700",
  },
  sceneName: {
    flex: 1,
    color: C.text,
    fontSize: 15,
    fontWeight: "600",
  },
  sceneAction: {
    color: C.muted,
    fontSize: 14,
    fontWeight: "600",
  },
  sceneActive: {
    color: C.green,
    fontSize: 14,
    fontWeight: "700",
  },

  // Event
  eventRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 13,
    paddingBottom: 16,
  },
  eventDivider: {
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  eventAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    backgroundColor: C.raised,
    alignItems: "center",
    justifyContent: "center",
  },
  eventAvatarText: {
    fontSize: 16,
    fontWeight: "700",
  },
  eventContent: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  eventUsername: {
    flex: 1,
    color: C.text,
    fontSize: 15,
    fontWeight: "700",
  },
  eventTime: {
    color: C.subtle,
    fontSize: 13,
  },
  eventMessage: {
    color: "#d5d8de",
    fontSize: 15,
    lineHeight: 21,
  },
  eventAmount: {
    color: C.orange,
    fontSize: 15,
    fontWeight: "700",
  },
  eventFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 2,
  },
  platformTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.raised,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  platformTagMark: {
    color: C.green,
    fontSize: 11,
    fontWeight: "800",
  },
  platformTagText: {
    color: C.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  eventType: {
    fontSize: 13,
    fontWeight: "600",
  },
  emptyState: {
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 20,
    gap: 10,
  },
  emptyDescription: {
    color: C.muted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },

  // Bottom bar
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: C.surface,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 10,
    paddingBottom: RNPlatform.OS === "ios" ? 26 : 12,
    paddingHorizontal: 8,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    minHeight: 48,
  },
  tabLabel: {
    color: C.subtle,
    fontSize: 12,
    fontWeight: "500",
  },
  tabLabelSelected: {
    color: C.green,
    fontWeight: "700",
  },
});