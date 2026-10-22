
import { useCallback, useEffect, useState } from "react";
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

import {
  connectObs,
  disconnectObs,
  getObsScenes,
  getObsStatus,
  getObsStreamStatus,
  setObsScene,
  type ObsScene,
  type ObsStatus,
  type ObsStreamStatus,
} from "../lib/api";

const COLORS = {
  background: "#101114",
  surface: "#191b20",
  surfaceRaised: "#20232a",
  border: "#30343d",
  text: "#f4f4f5",
  muted: "#a1a1aa",
  subtle: "#71717a",
  accent: "#d7ff64",
  green: "#4ade80",
  red: "#fb7185",
  blue: "#93c5fd",
};

export default function ExploreScreen() {
  const [status, setStatus] = useState<ObsStatus | null>(null);
  const [scenes, setScenes] = useState<ObsScene[]>([]);
  const [streamStatus, setStreamStatus] =
    useState<ObsStreamStatus | null>(null);

  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [changingScene, setChangingScene] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadObs = useCallback(async () => {
    try {
      const currentStatus = await getObsStatus();

      setStatus(currentStatus);
      setError(null);

      if (!currentStatus.connected) {
        setScenes([]);
        setStreamStatus(null);
        return;
      }

      const [sceneResult, streamResult] = await Promise.all([
        getObsScenes(),
        getObsStreamStatus(),
      ]);

      setScenes(sceneResult.scenes);
      setStreamStatus(streamResult);
      setStatus((previous) =>
        previous
          ? { ...previous, currentScene: sceneResult.currentScene }
          : previous,
      );
    } catch (err) {
      setStatus(null);
      setScenes([]);
      setStreamStatus(null);
      setError(
        err instanceof Error ? err.message : "Gagal mengambil status OBS.",
      );
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      try {
        await loadObs();
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void initialize();

    return () => {
      mounted = false;
    };
  }, [loadObs]);

  const refresh = useCallback(async () => {
    setRefreshing(true);

    try {
      await loadObs();
    } finally {
      setRefreshing(false);
    }
  }, [loadObs]);

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);

    try {
      const result = await connectObs();
      setStatus(result);
      await loadObs();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Koneksi OBS gagal.";

      setError(message);
      Alert.alert("OBS tidak terhubung", message);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = () => {
    Alert.alert(
      "Putuskan koneksi OBS?",
      "Koneksi kontrol akan diputus. Siaran dan recording yang sedang berjalan tidak akan dihentikan.",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Putuskan",
          style: "destructive",
          onPress: async () => {
            setDisconnecting(true);

            try {
              await disconnectObs();
              setStatus(null);
              setScenes([]);
              setStreamStatus(null);
              setError(null);
            } catch (err) {
              const message =
                err instanceof Error
                  ? err.message
                  : "Gagal memutuskan koneksi OBS.";

              setError(message);
              Alert.alert("Gagal memutuskan koneksi", message);
            } finally {
              setDisconnecting(false);
            }
          },
        },
      ],
    );
  };

  const handleSceneChange = async (scene: ObsScene) => {
    if (scene.name === status?.currentScene || changingScene !== null) {
      return;
    }

    setChangingScene(scene.name);

    try {
      const result = await setObsScene(scene.name);

      if (!result.success) {
        throw new Error(result.message ?? "Gagal mengganti scene.");
      }

      setStatus((previous) =>
        previous ? { ...previous, currentScene: scene.name } : previous,
      );

      await loadObs();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal mengganti scene.";

      Alert.alert("Scene gagal diganti", message);
    } finally {
      setChangingScene(null);
    }
  };

  const connected = status?.connected === true;
  const streaming = streamStatus?.streaming ?? status?.streaming ?? false;
  const recording = status?.recording ?? false;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void refresh()}
          tintColor={COLORS.accent}
          colors={[COLORS.accent]}
        />
      }
    >
      <View style={styles.topBar}>
        <View>
          <Text style={styles.brand}>KILN<Text style={styles.brandDot}>.</Text></Text>
          <Text style={styles.topLabel}>CREATOR TOOLS</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Refresh status OBS"
          onPress={() => void refresh()}
          disabled={refreshing || loading}
          style={({ pressed }) => [
            styles.refreshButton,
            pressed && styles.pressed,
          ]}
        >
          {refreshing ? (
            <ActivityIndicator color={COLORS.text} size="small" />
          ) : (
            <Text style={styles.refreshIcon}>↻</Text>
          )}
        </Pressable>
      </View>

      <View style={styles.pageHeading}>
        <Text style={styles.eyebrow}>REMOTE CONTROL / 01</Text>
        <Text style={styles.title}>OBS Studio</Text>
        <Text style={styles.subtitle}>
          Kendalikan studio streaming dari telapak tangan.
        </Text>
      </View>

      <View style={styles.connectionCard}>
        <View style={styles.connectionTop}>
          <View
            style={[
              styles.connectionIcon,
              connected && styles.connectionIconActive,
            ]}
          >
            <Text style={styles.connectionIconText}>◉</Text>
          </View>

          <View style={styles.connectionInfo}>
            <Text style={styles.connectionTitle}>
              {connected ? "Studio terhubung" : "Studio tidak terhubung"}
            </Text>
            <View style={styles.connectionMeta}>
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor: connected ? COLORS.green : COLORS.red,
                  },
                ]}
              />
              <Text style={styles.connectionMetaText}>
                {connected ? "WEBSOCKET AKTIF" : "MENUNGGU KONEKSI"}
              </Text>
            </View>
          </View>

          {loading && <ActivityIndicator color={COLORS.accent} />}
        </View>

        {connected && status && (
          <View style={styles.versionBox}>
            <Text style={styles.versionLabel}>OBS VERSION</Text>
            <Text style={styles.versionValue}>
              {status.obsVersion || "Terhubung"}
            </Text>
          </View>
        )}

        <Pressable
          accessibilityRole="button"
          disabled={connecting || disconnecting || loading}
          onPress={() =>
            connected ? handleDisconnect() : void handleConnect()
          }
          style={({ pressed }) => [
            styles.connectionButton,
            connected && styles.connectionButtonDisconnect,
            (pressed || connecting || disconnecting || loading) &&
              styles.pressed,
          ]}
        >
          {connecting || disconnecting ? (
            <ActivityIndicator color={COLORS.background} />
          ) : (
            <Text style={styles.connectionButtonText}>
              {connected ? "Putuskan koneksi" : "Hubungkan OBS"}
            </Text>
          )}
        </Pressable>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>Koneksi bermasalah</Text>
            <Text style={styles.errorText}>{error}</Text>
            <Text style={styles.errorHint}>
              Periksa apakah OBS berjalan, WebSocket Server aktif, dan backend
              dapat diakses dari perangkat ini.
            </Text>
          </View>
        )}
      </View>

      {connected && (
        <>
          <View style={styles.sectionHeading}>
            <View>
              <Text style={styles.sectionTitle}>Studio overview</Text>
              <Text style={styles.sectionSubtitle}>
                Kondisi siaran saat ini
              </Text>
            </View>
            <View style={styles.liveIndicator}>
              <View
                style={[
                  styles.liveDot,
                  { backgroundColor: streaming ? COLORS.red : COLORS.subtle },
                ]}
              />
              <Text
                style={[
                  styles.liveText,
                  { color: streaming ? COLORS.red : COLORS.muted },
                ]}
              >
                {streaming ? "LIVE" : "OFFLINE"}
              </Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <View style={styles.statCardTop}>
                <Text style={styles.statIcon}>◉</Text>
                <Text style={styles.statLabel}>STREAMING</Text>
              </View>
              <Text
                style={[
                  styles.statValue,
                  { color: streaming ? COLORS.red : COLORS.text },
                ]}
              >
                {streaming ? "LIVE" : "Offline"}
              </Text>
              <Text style={styles.statDescription}>
                {streaming ? "Siaran sedang berjalan" : "Belum mengudara"}
              </Text>
            </View>

            <View style={styles.statCard}>
              <View style={styles.statCardTop}>
                <Text style={styles.statIcon}>▣</Text>
                <Text style={styles.statLabel}>RECORDING</Text>
              </View>
              <Text
                style={[
                  styles.statValue,
                  { color: recording ? COLORS.green : COLORS.text },
                ]}
              >
                {recording ? "Aktif" : "Off"}
              </Text>
              <Text style={styles.statDescription}>
                {recording ? "Perekaman berlangsung" : "Tidak merekam"}
              </Text>
            </View>
          </View>

          <View style={styles.sectionHeading}>
            <View>
              <Text style={styles.sectionTitle}>Scene collection</Text>
              <Text style={styles.sectionSubtitle}>
                Pilih tampilan untuk siaranmu
              </Text>
            </View>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{scenes.length}</Text>
            </View>
          </View>

          <View style={styles.sceneCard}>
            {scenes.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>Belum ada scene</Text>
                <Text style={styles.emptyText}>
                  Refresh status atau periksa scene di OBS Studio.
                </Text>
              </View>
            ) : (
              scenes.map((scene, index) => {
                const active = scene.name === status.currentScene;
                const busy = changingScene === scene.name;

                return (
                  <Pressable
                    key={`${scene.index}-${scene.name}`}
                    accessibilityRole="button"
                    accessibilityState={{
                      selected: active,
                      disabled: changingScene !== null || active,
                    }}
                    disabled={changingScene !== null || active}
                    onPress={() => void handleSceneChange(scene)}
                    style={({ pressed }) => [
                      styles.sceneRow,
                      active && styles.sceneRowActive,
                      pressed && styles.pressed,
                      index < scenes.length - 1 && styles.sceneDivider,
                    ]}
                  >
                    <View
                      style={[
                        styles.sceneThumbnail,
                        active && styles.sceneThumbnailActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.sceneThumbnailText,
                          active && styles.sceneThumbnailTextActive,
                        ]}
                      >
                        {String(index + 1).padStart(2, "0")}
                      </Text>
                    </View>

                    <View style={styles.sceneDetails}>
                      <Text style={styles.sceneName} numberOfLines={1}>
                        {scene.name}
                      </Text>
                      <Text style={styles.sceneCaption}>
                        {active ? "Sedang digunakan" : "Beralih ke scene ini"}
                      </Text>
                    </View>

                    <View style={styles.sceneAction}>
                      {busy ? (
                        <ActivityIndicator color={COLORS.accent} />
                      ) : active ? (
                        <View style={styles.activeBadge}>
                          <View style={styles.activeBadgeDot} />
                          <Text style={styles.activeBadgeText}>AKTIF</Text>
                        </View>
                      ) : (
                        <Text style={styles.sceneArrow}>↗</Text>
                      )}
                    </View>
                  </Pressable>
                );
              })
            )}
          </View>

          {streamStatus && (
            <View style={styles.bandwidthCard}>
              <View style={styles.bandwidthTop}>
                <View>
                  <Text style={styles.bandwidthTitle}>Data terkirim</Text>
                  <Text style={styles.sectionSubtitle}>
                    Total data pada sesi streaming
                  </Text>
                </View>
                <Text style={styles.bandwidthValue}>
                  {(streamStatus.bytes / (1024 * 1024)).toFixed(2)}
                  <Text style={styles.bandwidthUnit}> MB</Text>
                </Text>
              </View>
              <View style={styles.bandwidthTrack}>
                <View
                  style={[
                    styles.bandwidthFill,
                    { width: streaming ? "72%" : "0%" },
                  ]}
                />
              </View>
              <Text style={styles.bandwidthNote}>
                Statistik total data, bukan indikator kecepatan jaringan.
              </Text>
            </View>
          )}
        </>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerMark}>K</Text>
        <Text style={styles.footerText}>
          KILN REMOTE{"\n"}
          <Text style={styles.footerSubtext}>
            Kontrol studio, tanpa menyentuh siaran secara tidak sengaja.
          </Text>
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 44,
    gap: 22,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: {
    color: COLORS.text,
    fontSize: 25,
    fontWeight: "900",
    letterSpacing: 2,
  },
  brandDot: {
    color: COLORS.accent,
  },
  topLabel: {
    color: COLORS.subtle,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 2,
    marginTop: 3,
  },
  refreshButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  refreshIcon: {
    color: COLORS.text,
    fontSize: 28,
    lineHeight: 32,
  },
  pageHeading: {
    gap: 7,
    marginTop: 3,
  },
  eyebrow: {
    color: COLORS.accent,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.8,
  },
  title: {
    color: COLORS.text,
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: -1,
  },
  subtitle: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  connectionCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
    gap: 16,
  },
  connectionTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  connectionIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: COLORS.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  connectionIconActive: {
    backgroundColor: "#28351c",
  },
  connectionIconText: {
    color: COLORS.accent,
    fontSize: 26,
    fontWeight: "700",
  },
  connectionInfo: {
    flex: 1,
    gap: 7,
  },
  connectionTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "800",
  },
  connectionMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  connectionMetaText: {
    color: COLORS.muted,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
  },
  versionBox: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 13,
    gap: 4,
  },
  versionLabel: {
    color: COLORS.subtle,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  versionValue: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "600",
  },
  connectionButton: {
    minHeight: 48,
    borderRadius: 13,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  connectionButtonDisconnect: {
    backgroundColor: COLORS.surfaceRaised,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  connectionButtonText: {
    color: COLORS.background,
    fontSize: 13,
    fontWeight: "900",
  },
  errorBox: {
    backgroundColor: "#351b22",
    borderRadius: 12,
    padding: 13,
    gap: 6,
  },
  errorTitle: {
    color: "#fecdd3",
    fontSize: 13,
    fontWeight: "800",
  },
  errorText: {
    color: "#fda4af",
    fontSize: 12,
    lineHeight: 18,
  },
  errorHint: {
    color: "#fecdd3",
    fontSize: 11,
    lineHeight: 17,
  },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: -12,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveText: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 17,
    padding: 14,
    gap: 12,
  },
  statCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  statIcon: {
    color: COLORS.accent,
    fontSize: 15,
  },
  statLabel: {
    color: COLORS.muted,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.7,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  statDescription: {
    color: COLORS.subtle,
    fontSize: 10,
    lineHeight: 15,
  },
  countBadge: {
    minWidth: 31,
    height: 31,
    paddingHorizontal: 9,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceRaised,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  countText: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: "900",
  },
  sceneCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 13,
    paddingVertical: 4,
    overflow: "hidden",
  },
  sceneRow: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 3,
  },
  sceneRowActive: {
    backgroundColor: "#242b1d",
    borderRadius: 12,
    paddingHorizontal: 9,
  },
  sceneDivider: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sceneThumbnail: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sceneThumbnailActive: {
    backgroundColor: "#354522",
    borderColor: "#627c37",
  },
  sceneThumbnailText: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: "900",
  },
  sceneThumbnailTextActive: {
    color: COLORS.accent,
  },
  sceneDetails: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  sceneName: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "800",
  },
  sceneCaption: {
    color: COLORS.muted,
    fontSize: 10,
  },
  sceneAction: {
    minWidth: 48,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  activeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#354522",
    borderRadius: 7,
    paddingHorizontal: 7,
    paddingVertical: 6,
  },
  activeBadgeDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.accent,
  },
  activeBadgeText: {
    color: COLORS.accent,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  sceneArrow: {
    color: COLORS.muted,
    fontSize: 20,
  },
  emptyState: {
    paddingVertical: 22,
    paddingHorizontal: 8,
    gap: 7,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "800",
  },
  emptyText: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  bandwidthCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 17,
    padding: 16,
    gap: 13,
  },
  bandwidthTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  bandwidthTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "800",
  },
  bandwidthValue: {
    color: COLORS.accent,
    fontSize: 22,
    fontWeight: "900",
  },
  bandwidthUnit: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  bandwidthTrack: {
    height: 5,
    backgroundColor: COLORS.surfaceRaised,
    borderRadius: 4,
    overflow: "hidden",
  },
  bandwidthFill: {
    height: "100%",
    backgroundColor: COLORS.accent,
    borderRadius: 4,
  },
  bandwidthNote: {
    color: COLORS.subtle,
    fontSize: 10,
    lineHeight: 15,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 11,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 19,
    marginTop: 1,
  },
  footerMark: {
    width: 32,
    height: 32,
    borderRadius: 10,
    overflow: "hidden",
    textAlign: "center",
    textAlignVertical: "center",
    backgroundColor: COLORS.accent,
    color: COLORS.background,
    fontSize: 18,
    fontWeight: "900",
    paddingTop: 4,
  },
  footerText: {
    color: COLORS.text,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    lineHeight: 16,
  },
  footerSubtext: {
    color: COLORS.subtle,
    fontSize: 10,
    fontWeight: "400",
    letterSpacing: 0,
  },
  pressed: {
    opacity: 0.65,
  },
});
