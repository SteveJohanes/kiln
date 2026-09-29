import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
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
  return new Date(timestamp).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Index() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [socketConnected, setSocketConnected] = useState(
    socket.connected,
  );
  const [error, setError] = useState<string | null>(null);

  async function loadDashboard(isRefresh = false) {
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
    try {
      setSessionLoading(true);
      setError(null);

      let session = dashboard?.session;

      if (!session || session.status === "ended") {
        session = await createSession([
          "youtube",
          "tiktok",
        ]);
      }

      const startedSession = await startSession(session.id);

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

      const endedSession = await endSession(session.id);

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

  useEffect(() => {
    void loadDashboard();

    function handleConnect() {
      setSocketConnected(true);
    }

    function handleDisconnect() {
      setSocketConnected(false);
    }

    function handleStreamEvent(event: DashboardEvent) {
      setDashboard((currentDashboard) => {
        if (!currentDashboard) {
          return currentDashboard;
        }

        const existingEvent =
          currentDashboard.events.recent.some(
            (existing) => existing.id === event.id,
          );

        if (existingEvent) {
          return currentDashboard;
        }

        return {
          ...currentDashboard,
          events: {
            total: currentDashboard.events.total + 1,
            recent: [
              event,
              ...currentDashboard.events.recent,
            ].slice(0, 20),
          },
        };
      });
    }

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("stream:event", handleStreamEvent);

    connectSocket();

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("stream:event", handleStreamEvent);

      disconnectSocket();
    };
  }, []);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" />

        <Text style={styles.loadingText}>
          Menghubungkan ke StreamDex...
        </Text>
      </View>
    );
  }

  const isLive = dashboard?.session?.status === "live";

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void loadDashboard(true)}
        />
      }
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.logo}>StreamDex</Text>
          <Text style={styles.subtitle}>
            Live Dashboard
          </Text>
        </View>

        <View
          style={[
            styles.statusBadge,
            isLive ? styles.statusLive : styles.statusIdle,
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
            {isLive ? "LIVE" : "OFFLINE"}
          </Text>
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

          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.sessionCard}>
        <Text style={styles.cardTitle}>
          Stream Session
        </Text>

        {dashboard?.session ? (
          <>
            <Text style={styles.sessionStatus}>
              {isLive ? "Sedang live" : dashboard.session.status}
            </Text>

            <Text style={styles.cardLabel}>Platform</Text>

            <View style={styles.platformContainer}>
              {dashboard.session.platforms.map((platform) => (
                <View
                  key={platform}
                  style={styles.platformBadge}
                >
                  <Text style={styles.platformText}>
                    {getPlatformLabel(platform)}
                  </Text>
                </View>
              ))}
            </View>

            {dashboard.session.startedAt && (
              <Text style={styles.startedText}>
                Dimulai{" "}
                {formatEventTime(
                  dashboard.session.startedAt,
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
                disabled={sessionLoading}
                onPress={() => void handleEndStream()}
              >
                {sessionLoading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.sessionButtonText}>
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
                disabled={sessionLoading}
                onPress={() => void handleStartStream()}
              >
                {sessionLoading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.sessionButtonText}>
                    MULAI STREAM
                  </Text>
                )}
              </Pressable>
            )}
          </>
        ) : (
          <View style={styles.emptySession}>
            <Text style={styles.emptyTitle}>
              Tidak ada session aktif
            </Text>

            <Text style={styles.emptyText}>
              Tekan tombol di bawah untuk membuat session
              YouTube dan TikTok.
            </Text>

            <Pressable
              style={[
                styles.sessionButton,
                styles.startButton,
                sessionLoading &&
                  styles.sessionButtonDisabled,
              ]}
              disabled={sessionLoading}
              onPress={() => void handleStartStream()}
            >
              {sessionLoading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.sessionButtonText}>
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

          <Text style={styles.statLabel}>Total Event</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statValue}>
            {dashboard?.events.recent.length ?? 0}
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
            {dashboard.events.recent.map((event) => (
              <View
                key={event.id}
                style={styles.eventItem}
              >
                <View style={styles.eventTopRow}>
                  <Text style={styles.eventUsername}>
                    {event.username}
                  </Text>

                  <Text style={styles.eventTime}>
                    {formatEventTime(event.timestamp)}
                  </Text>
                </View>

                <Text style={styles.eventMessage}>
                  {event.message ??
                    getEventTypeLabel(event.type)}
                </Text>

                <View style={styles.eventBottomRow}>
                  <Text style={styles.eventPlatform}>
                    {getPlatformLabel(event.platform)}
                  </Text>

                  <Text style={styles.eventType}>
                    {getEventTypeLabel(event.type)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyEvents}>
            <Text style={styles.emptyTitle}>
              Belum ada event
            </Text>

            <Text style={styles.emptyText}>
              Chat, donation, follow, dan event lainnya akan
              muncul di sini.
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