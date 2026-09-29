import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import {
  createSession,
  endSession,
  getDashboard,
  startSession,
  type DashboardData,
  type DashboardEvent,
  type Platform,
} from "../lib/api";
import {
  connectSocket,
  disconnectSocket,
  socket,
} from "../lib/socket";
import { useAuth } from "../lib/auth-context";

const AVAILABLE_PLATFORMS: Platform[] = [
  "youtube",
  "tiktok",
  "twitch",
  "kick",
];

function getPlatformLabel(platform: string): string {
  switch (platform) {
    case "youtube":
      return "YouTube";
    case "tiktok":
      return "TikTok";
    case "twitch":
      return "Twitch";
    case "kick":
      return "Kick";
    default:
      return platform;
  }
}

function getEventTypeLabel(type: string): string {
  switch (type) {
    case "chat":
      return "Chat";
    case "donation":
      return "Donation";
    case "follow":
      return "Follow";
    case "subscribe":
      return "Subscribe";
    case "member":
      return "Member";
    case "raid":
      return "Raid";
    case "system":
      return "System";
    default:
      return type;
  }
}

function formatEventTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString(
    "id-ID",
    {
      hour: "2-digit",
      minute: "2-digit",
    },
  );
}

export default function Index() {
  const {
    user,
    logout,
  } = useAuth();

  const [dashboard, setDashboard] =
    useState<DashboardData | null>(null);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [sessionLoading, setSessionLoading] =
    useState(false);

  const [loggingOut, setLoggingOut] =
    useState(false);

  const [socketConnected, setSocketConnected] =
    useState(socket.connected);

  const [error, setError] =
    useState<string | null>(null);

  const [selectedPlatforms, setSelectedPlatforms] =
    useState<Platform[]>(["youtube", "tiktok"]);

  function togglePlatform(
    platform: Platform,
  ): void {
    setSelectedPlatforms((currentPlatforms) => {
      const isSelected =
        currentPlatforms.includes(platform);

      if (isSelected) {
        return currentPlatforms.filter(
          (currentPlatform) =>
            currentPlatform !== platform,
        );
      }

      return [
        ...currentPlatforms,
        platform,
      ];
    });
  }

  async function loadDashboard(
    isRefresh = false,
  ) {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      const data = await getDashboard();

      setDashboard(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal mengambil data dashboard.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleStartStream() {
    if (selectedPlatforms.length === 0) {
      Alert.alert(
        "Platform belum dipilih",
        "Pilih minimal satu platform sebelum memulai stream.",
      );

      return;
    }

    try {
      setSessionLoading(true);
      setError(null);

      let session = dashboard?.session;

      if (
        !session ||
        session.status === "ended"
      ) {
        session = await createSession(
          selectedPlatforms,
        );
      }

      const startedSession =
        await startSession(session.id);

      setDashboard((currentDashboard) => {
        if (!currentDashboard) {
          return currentDashboard;
        }

        return {
          ...currentDashboard,
          session: startedSession,
        };
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal memulai stream.",
      );
    } finally {
      setSessionLoading(false);
    }
  }

  async function handleEndStream() {
    const session = dashboard?.session;

    if (!session) {
      return;
    }

    try {
      setSessionLoading(true);
      setError(null);

      const endedSession =
        await endSession(session.id);

      setDashboard((currentDashboard) => {
        if (!currentDashboard) {
          return currentDashboard;
        }

        return {
          ...currentDashboard,
          session: endedSession,
        };
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal mengakhiri stream.",
      );
    } finally {
      setSessionLoading(false);
    }
  }

  function handleLogout() {
    Alert.alert(
      "Keluar",
      "Apakah kamu yakin ingin keluar dari akun?",
      [
        {
          text: "Batal",
          style: "cancel",
        },
        {
          text: "Keluar",
          style: "destructive",
          onPress: () => {
            void performLogout();
          },
        },
      ],
    );
  }

  async function performLogout() {
    try {
      setLoggingOut(true);

      disconnectSocket();

      await logout();
    } catch (err) {
      console.error(
        "Gagal melakukan logout:",
        err,
      );
    } finally {
      setLoggingOut(false);
    }
  }

  useEffect(() => {
    void loadDashboard();

    function handleConnect() {
      setSocketConnected(true);
    }

    function handleDisconnect() {
      setSocketConnected(false);
    }

    function handleStreamEvent(
      event: DashboardEvent,
    ) {
      setDashboard((currentDashboard) => {
        if (!currentDashboard) {
          return currentDashboard;
        }

        const existingEvent =
          currentDashboard.events.recent.some(
            (existing) =>
              existing.id === event.id,
          );

        if (existingEvent) {
          return currentDashboard;
        }

        return {
          ...currentDashboard,
          events: {
            total:
              currentDashboard.events.total + 1,
            recent: [
              event,
              ...currentDashboard.events.recent,
            ].slice(0, 20),
          },
        };
      });
    }

    socket.on("connect", handleConnect);
    socket.on(
      "disconnect",
      handleDisconnect,
    );
    socket.on(
      "stream:event",
      handleStreamEvent,
    );

    connectSocket();

    return () => {
      socket.off(
        "connect",
        handleConnect,
      );
      socket.off(
        "disconnect",
        handleDisconnect,
      );
      socket.off(
        "stream:event",
        handleStreamEvent,
      );

      disconnectSocket();
    };
  }, []);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" />

        <Text style={styles.loadingText}>
          Menghubungkan ke Kiln...
        </Text>
      </View>
    );
  }

  const isLive =
    dashboard?.session?.status === "live";

  const hasActiveSession =
    dashboard?.session &&
    dashboard.session.status !== "ended";

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() =>
            void loadDashboard(true)
          }
        />
      }
    >
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <Text style={styles.logo}>
            KILN
          </Text>

          <Text style={styles.subtitle}>
            {user?.email ??
              "Live Dashboard"}
          </Text>
        </View>

        <View style={styles.headerActions}>
          <View
            style={[
              styles.statusBadge,
              isLive
                ? styles.statusLive
                : styles.statusIdle,
            ]}
          >
            <View
              style={[
                styles.statusDot,
                isLive
                  ? styles.statusDotLive
                  : styles.statusDotIdle,
              ]}
            />

            <Text style={styles.statusText}>
              {isLive
                ? "LIVE"
                : "OFFLINE"}
            </Text>
          </View>

          <Pressable
            onPress={() =>
              router.push("/account")
            }
            style={({ pressed }) => [
              styles.accountButton,
              pressed &&
                styles.accountButtonPressed,
            ]}
          >
            <Text style={styles.accountText}>
              Account
            </Text>
          </Pressable>

          <Pressable
            onPress={handleLogout}
            disabled={loggingOut}
            style={({ pressed }) => [
              styles.logoutButton,
              pressed &&
                styles.logoutButtonPressed,
              loggingOut &&
                styles.logoutButtonDisabled,
            ]}
          >
            {loggingOut ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.logoutText}>
                Keluar
              </Text>
            )}
          </Pressable>
        </View>
      </View>

      <View style={styles.connectionCard}>
        <View
          style={[
            styles.connectionDot,
            socketConnected
              ? styles.connectionDotOnline
              : styles.connectionDotOffline,
          ]}
        />

        <Text style={styles.connectionText}>
          {socketConnected
            ? "Realtime terhubung"
            : "Realtime terputus"}
        </Text>
      </View>

      {error && (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>
            Koneksi bermasalah
          </Text>

          <Text style={styles.errorText}>
            {error}
          </Text>
        </View>
      )}

      {!hasActiveSession && (
        <View style={styles.platformCard}>
          <Text style={styles.cardTitle}>
            Platform Livestream
          </Text>

          <Text style={styles.platformDescription}>
            Pilih platform yang ingin digunakan
            untuk session ini.
          </Text>

          <View style={styles.selectionList}>
            {AVAILABLE_PLATFORMS.map(
              (platform) => {
                const isSelected =
                  selectedPlatforms.includes(
                    platform,
                  );

                return (
                  <Pressable
                    key={platform}
                    onPress={() =>
                      togglePlatform(
                        platform,
                      )
                    }
                    style={({ pressed }) => [
                      styles.platformOption,
                      isSelected &&
                        styles.platformOptionSelected,
                      pressed &&
                        styles.platformOptionPressed,
                    ]}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        isSelected &&
                          styles.checkboxSelected,
                      ]}
                    >
                      {isSelected && (
                        <Text
                          style={
                            styles.checkmark
                          }
                        >
                          ✓
                        </Text>
                      )}
                    </View>

                    <Text
                      style={[
                        styles.platformOptionText,
                        isSelected &&
                          styles.platformOptionTextSelected,
                      ]}
                    >
                      {getPlatformLabel(
                        platform,
                      )}
                    </Text>
                  </Pressable>
                );
              },
            )}
          </View>

          <Text style={styles.selectedText}>
            {selectedPlatforms.length > 0
              ? `${selectedPlatforms.length} platform dipilih`
              : "Belum ada platform dipilih"}
          </Text>
        </View>
      )}

      <View style={styles.sessionCard}>
        <Text style={styles.cardTitle}>
          Stream Session
        </Text>

        {dashboard?.session ? (
          <>
            <Text style={styles.sessionStatus}>
              {isLive
                ? "Sedang live"
                : dashboard.session.status}
            </Text>

            <Text style={styles.cardLabel}>
              Platform
            </Text>

            <View
              style={
                styles.platformContainer
              }
            >
              {dashboard.session.platforms.map(
                (platform) => (
                  <View
                    key={platform}
                    style={
                      styles.platformBadge
                    }
                  >
                    <Text
                      style={
                        styles.platformText
                      }
                    >
                      {getPlatformLabel(
                        platform,
                      )}
                    </Text>
                  </View>
                ),
              )}
            </View>

            {dashboard.session.startedAt && (
              <Text
                style={styles.startedText}
              >
                Dimulai{" "}
                {formatEventTime(
                  dashboard.session
                    .startedAt,
                )}
              </Text>
            )}

            {isLive ? (
              <Pressable
                style={[
                  styles.sessionButton,
                  styles.endButton,
                  sessionLoading &&
                    styles.sessionButtonDisabled,
                ]}
                disabled={
                  sessionLoading
                }
                onPress={() =>
                  void handleEndStream()
                }
              >
                {sessionLoading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text
                    style={
                      styles.sessionButtonText
                    }
                  >
                    AKHIRI STREAM
                  </Text>
                )}
              </Pressable>
            ) : (
              <Pressable
                style={[
                  styles.sessionButton,
                  styles.startButton,
                  sessionLoading &&
                    styles.sessionButtonDisabled,
                ]}
                disabled={
                  sessionLoading
                }
                onPress={() =>
                  void handleStartStream()
                }
              >
                {sessionLoading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text
                    style={
                      styles.sessionButtonText
                    }
                  >
                    MULAI STREAM
                  </Text>
                )}
              </Pressable>
            )}
          </>
        ) : (
          <View
            style={styles.emptySession}
          >
            <Text
              style={styles.emptyTitle}
            >
              Tidak ada session aktif
            </Text>

            <Text
              style={styles.emptyText}
            >
              Pilih platform di atas, kemudian
              tekan tombol mulai stream.
            </Text>

            <Pressable
              style={[
                styles.sessionButton,
                styles.startButton,
                sessionLoading ||
                  selectedPlatforms.length ===
                    0
                  ? styles.sessionButtonDisabled
                  : null,
              ]}
              disabled={
                sessionLoading ||
                selectedPlatforms.length ===
                  0
              }
              onPress={() =>
                void handleStartStream()
              }
            >
              {sessionLoading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text
                  style={
                    styles.sessionButtonText
                  }
                >
                  MULAI STREAM
                </Text>
              )}
            </Pressable>
          </View>
        )}
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>
            {dashboard?.events.total ?? 0}
          </Text>

          <Text style={styles.statLabel}>
            Total Event
          </Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statValue}>
            {dashboard?.events.recent.length ??
              0}
          </Text>

          <Text style={styles.statLabel}>
            Event Terbaru
          </Text>
        </View>
      </View>

      <View style={styles.eventsCard}>
        <View style={styles.eventsHeader}>
          <Text style={styles.cardTitle}>
            Recent Events
          </Text>

          <Text style={styles.eventCount}>
            {dashboard?.events.total ?? 0}
          </Text>
        </View>

        {dashboard?.events.recent.length ? (
          <View style={styles.eventList}>
            {dashboard.events.recent.map(
              (event) => (
                <View
                  key={event.id}
                  style={styles.eventItem}
                >
                  <View
                    style={
                      styles.eventTopRow
                    }
                  >
                    <Text
                      style={
                        styles.eventUsername
                      }
                    >
                      {event.username}
                    </Text>

                    <Text
                      style={
                        styles.eventTime
                      }
                    >
                      {formatEventTime(
                        event.timestamp,
                      )}
                    </Text>
                  </View>

                  <Text
                    style={
                      styles.eventMessage
                    }
                  >
                    {event.message ??
                      getEventTypeLabel(
                        event.type,
                      )}
                  </Text>

                  <View
                    style={
                      styles.eventBottomRow
                    }
                  >
                    <Text
                      style={
                        styles.eventPlatform
                      }
                    >
                      {getPlatformLabel(
                        event.platform,
                      )}
                    </Text>

                    <Text
                      style={
                        styles.eventType
                      }
                    >
                      {getEventTypeLabel(
                        event.type,
                      )}
                    </Text>
                  </View>
                </View>
              ),
            )}
          </View>
        ) : (
          <View
            style={styles.emptyEvents}
          >
            <Text
              style={styles.emptyTitle}
            >
              Belum ada event
            </Text>

            <Text
              style={styles.emptyText}
            >
              Chat, donation, follow, dan
              event lainnya akan muncul di
              sini.
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0f1115",
  },
  content: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f1115",
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    color: "#b8bcc7",
    fontSize: 15,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    gap: 12,
  },
  headerInfo: {
    flex: 1,
  },
  logo: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "800",
  },
  subtitle: {
    color: "#8f96a3",
    fontSize: 14,
    marginTop: 2,
  },
  headerActions: {
    alignItems: "flex-end",
    gap: 8,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusLive: {
    backgroundColor: "#32171b",
    borderColor: "#74323a",
  },
  statusIdle: {
    backgroundColor: "#1a1d23",
    borderColor: "#343945",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 7,
  },
  statusDotLive: {
    backgroundColor: "#ff4d5e",
  },
  statusDotIdle: {
    backgroundColor: "#737987",
  },
  statusText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
  },
  accountButton: {
    minWidth: 72,
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 9,
    backgroundColor: "#2563eb",
    borderWidth: 1,
    borderColor: "#3b82f6",
    alignItems: "center",
    justifyContent: "center",
  },
  accountButtonPressed: {
    opacity: 0.7,
  },
  accountText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  logoutButton: {
    minWidth: 72,
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 9,
    backgroundColor: "#292e38",
    borderWidth: 1,
    borderColor: "#3a414d",
    alignItems: "center",
    justifyContent: "center",
  },
  logoutButtonPressed: {
    opacity: 0.7,
  },
  logoutButtonDisabled: {
    opacity: 0.5,
  },
  logoutText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  connectionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#181b21",
    borderWidth: 1,
    borderColor: "#292e38",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 14,
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  connectionDotOnline: {
    backgroundColor: "#4ade80",
  },
  connectionDotOffline: {
    backgroundColor: "#f87171",
  },
  connectionText: {
    color: "#aeb4bf",
    fontSize: 12,
    fontWeight: "600",
  },
  platformCard: {
    backgroundColor: "#181b21",
    borderWidth: 1,
    borderColor: "#292e38",
    borderRadius: 18,
    padding: 20,
    marginBottom: 14,
  },
  platformDescription: {
    color: "#7f8795",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
    marginBottom: 16,
  },
  selectionList: {
    gap: 9,
  },
  platformOption: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#20242c",
    borderWidth: 1,
    borderColor: "#2d333e",
    borderRadius: 11,
    paddingHorizontal: 13,
  },
  platformOptionSelected: {
    backgroundColor: "#172c50",
    borderColor: "#2563eb",
  },
  platformOptionPressed: {
    opacity: 0.7,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#555d6b",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },
  checkboxSelected: {
    backgroundColor: "#2563eb",
    borderColor: "#3b82f6",
  },
  checkmark: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  platformOptionText: {
    color: "#d5d9e0",
    fontSize: 14,
    fontWeight: "600",
  },
  platformOptionTextSelected: {
    color: "#ffffff",
    fontWeight: "700",
  },
  selectedText: {
    color: "#7f8795",
    fontSize: 12,
    marginTop: 13,
  },
  sessionCard: {
    backgroundColor: "#181b21",
    borderWidth: 1,
    borderColor: "#292e38",
    borderRadius: 18,
    padding: 20,
    marginBottom: 14,
  },
  cardTitle: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "700",
  },
  sessionStatus: {
    color: "#ffffff",
    fontSize: 25,
    fontWeight: "800",
    marginTop: 16,
  },
  cardLabel: {
    color: "#7f8795",
    fontSize: 13,
    marginTop: 18,
    marginBottom: 8,
  },
  platformContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  platformBadge: {
    backgroundColor: "#242933",
    borderWidth: 1,
    borderColor: "#363d49",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  platformText: {
    color: "#e7e9ed",
    fontSize: 13,
    fontWeight: "600",
  },
  startedText: {
    color: "#7f8795",
    fontSize: 12,
    marginTop: 14,
  },
  sessionButton: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  startButton: {
    backgroundColor: "#2563eb",
  },
  endButton: {
    backgroundColor: "#dc3545",
  },
  sessionButtonDisabled: {
    opacity: 0.6,
  },
  sessionButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  emptySession: {
    marginTop: 16,
  },
  emptyTitle: {
    color: "#dce0e7",
    fontSize: 15,
    fontWeight: "600",
  },
  emptyText: {
    color: "#7f8795",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  statsContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#181b21",
    borderWidth: 1,
    borderColor: "#292e38",
    borderRadius: 18,
    padding: 18,
  },
  statValue: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "800",
  },
  statLabel: {
    color: "#7f8795",
    fontSize: 12,
    marginTop: 4,
  },
  eventsCard: {
    backgroundColor: "#181b21",
    borderWidth: 1,
    borderColor: "#292e38",
    borderRadius: 18,
    padding: 20,
  },
  eventsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  eventCount: {
    color: "#8f96a3",
    fontSize: 13,
  },
  eventList: {
    gap: 10,
  },
  eventItem: {
    backgroundColor: "#20242c",
    borderWidth: 1,
    borderColor: "#2d333e",
    borderRadius: 12,
    padding: 13,
  },
  eventTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  eventUsername: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  eventTime: {
    color: "#707886",
    fontSize: 11,
  },
  eventMessage: {
    color: "#d5d9e0",
    fontSize: 14,
    marginTop: 6,
  },
  eventBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
  },
  eventPlatform: {
    color: "#8f96a3",
    fontSize: 11,
    fontWeight: "600",
  },
  eventType: {
    color: "#737b89",
    fontSize: 11,
  },
  emptyEvents: {
    paddingVertical: 18,
  },
  errorCard: {
    backgroundColor: "#30191d",
    borderWidth: 1,
    borderColor: "#683139",
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
  },
  errorTitle: {
    color: "#ff8d99",
    fontSize: 14,
    fontWeight: "700",
  },
  errorText: {
    color: "#dbaeb3",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 5,
  },
});