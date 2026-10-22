
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import {
  API_BASE_URL,
  createOverlayToken,
  getDashboard,
  getOverlayTokens,
  revokeOverlayToken,
  type CreatedOverlayToken,
  type OverlayToken,
  type StreamSession,
} from "../lib/api";

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
  red: "#ff5d6c",
  redSoft: "#2b1519",
  blue: "#4aa3ff",
};

function absoluteOverlayUrl(url: string) {
  if (/^https?:\/\//i.test(url)) return url;

  return `${API_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

function formatDate(value: string | null) {
  if (!value) return "Tidak ada batas waktu";
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function OverlayScreen() {
  const [session, setSession] = useState<StreamSession | null>(null);
  const [tokens, setTokens] = useState<OverlayToken[]>([]);
  const [created, setCreated] = useState<CreatedOverlayToken | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError(null);

      const [dashboard, tokenList] = await Promise.all([
        getDashboard(),
        getOverlayTokens(),
      ]);

      setSession(dashboard.session);
      setTokens(tokenList);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal memuat informasi Overlay.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleCreateToken() {
    if (!session || session.status === "ended" || creating) return;

    try {
      setCreating(true);
      setError(null);

      const result = await createOverlayToken(session.id);
      setCreated(result);

      await loadData(false);

      Alert.alert(
        "Token berhasil dibuat",
        "Simpan URL Overlay ini. Token mentah hanya diberikan saat pembuatan.",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal membuat token Overlay.",
      );
    } finally {
      setCreating(false);
    }
  }

  async function handleShareUrl() {
    if (!created) return;

    const url = absoluteOverlayUrl(created.url);

    try {
      await Share.share({
        title: "StreamDex Overlay untuk OBS",
        message: url,
        url,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal membagikan URL Overlay.",
      );
    }
  }

  function confirmRevoke(token: OverlayToken) {
    Alert.alert(
      "Cabut token Overlay?",
      "Browser Source OBS yang menggunakan token ini tidak akan bisa terhubung lagi.",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Cabut token",
          style: "destructive",
          onPress: () => void handleRevoke(token.id),
        },
      ],
    );
  }

  async function handleRevoke(tokenId: string) {
    try {
      setRevokingId(tokenId);
      setError(null);

      await revokeOverlayToken(tokenId);

      setTokens((current) =>
        current.map((token) =>
          token.id === tokenId
            ? { ...token, revokedAt: new Date().toISOString() }
            : token,
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal mencabut token.",
      );
    } finally {
      setRevokingId(null);
    }
  }

  const sessionUsable =
    !!session && session.status !== "ended";

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={C.green} size="large" />
        <Text style={styles.muted}>Memuat Overlay...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Kembali ke dashboard"
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={22} color={C.text} />
          </Pressable>

          <View style={styles.headerText}>
            <Text style={styles.title}>Overlay OBS</Text>
            <Text style={styles.muted}>
              Kelola URL overlay streaming kamu
            </Text>
          </View>
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>Terjadi masalah</Text>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={() => void loadData()}>
              <Text style={styles.retry}>Coba lagi</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.card}>
          <View style={styles.cardHeading}>
            <View style={styles.iconBox}>
              <Ionicons
                name="layers-outline"
                size={24}
                color={C.green}
              />
            </View>
            <View style={styles.flex}>
              <Text style={styles.cardTitle}>Sesi streaming</Text>
              <Text style={styles.muted}>
                {session
                  ? session.status === "live"
                    ? "Sedang live"
                    : session.status === "ended"
                      ? "Sesi sudah berakhir"
                      : "Sesi tersedia"
                  : "Belum ada sesi"}
              </Text>
            </View>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: sessionUsable ? C.green : C.subtle,
                },
              ]}
            />
          </View>

          {session ? (
            <>
              <Text style={styles.sessionId} selectable>
                ID: {session.id}
              </Text>
              <View style={styles.platforms}>
                {session.platforms.map((platform) => (
                  <View key={platform} style={styles.platformChip}>
                    <Text style={styles.platformText}>{platform}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <Text style={styles.bodyText}>
              Buat sesi streaming dari dashboard terlebih dahulu.
              Token Overlay terikat pada sesi streaming.
            </Text>
          )}

          <Pressable
            accessibilityRole="button"
            disabled={!sessionUsable || creating}
            onPress={() => void handleCreateToken()}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.pressed,
              (!sessionUsable || creating) && styles.disabled,
            ]}
          >
            {creating ? (
              <ActivityIndicator color={C.bg} />
            ) : (
              <>
                <Ionicons
                  name="key-outline"
                  size={19}
                  color={C.bg}
                />
                <Text style={styles.primaryButtonText}>
                  Buat Token Overlay
                </Text>
              </>
            )}
          </Pressable>
        </View>

        {created && (
          <View style={styles.successCard}>
            <View style={styles.cardHeading}>
              <Ionicons
                name="checkmark-circle"
                size={24}
                color={C.green}
              />
              <Text style={styles.cardTitle}>Token berhasil dibuat</Text>
            </View>

            <Text style={styles.bodyText}>
              Masukkan URL ini sebagai Browser Source di OBS. URL lengkap
              menggunakan alamat backend yang dikonfigurasi aplikasi.
            </Text>

            <Text style={styles.fieldLabel}>URL Overlay</Text>
            <Text selectable style={styles.url}>
              {absoluteOverlayUrl(created.url)}
            </Text>

            <Pressable
              accessibilityRole="button"
              onPress={() => void handleShareUrl()}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name="share-outline" size={19} color={C.bg} />
              <Text style={styles.primaryButtonText}>
                Salin / Bagikan URL
              </Text>
            </Pressable>

            {created.warning ? (
              <Text style={styles.warning}>{created.warning}</Text>
            ) : null}

            <Text style={styles.muted}>
              Simpan URL ini sekarang. Daftar token hanya menyimpan
              metadata, bukan token mentah yang baru dibuat.
            </Text>
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Token tersimpan</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void loadData()}
            style={styles.refreshButton}
          >
            <Ionicons name="refresh" size={17} color={C.green} />
            <Text style={styles.refreshText}>Segarkan</Text>
          </Pressable>
        </View>

        {tokens.length === 0 ? (
          <View style={styles.card}>
            <Ionicons
              name="key-outline"
              size={28}
              color={C.subtle}
            />
            <Text style={styles.cardTitle}>Belum ada token</Text>
            <Text style={styles.muted}>
              Token yang berhasil dibuat akan tercatat di sini.
            </Text>
          </View>
        ) : (
          tokens.map((token) => {
            const revoked = !!token.revokedAt;
            const expired =
              !!token.expiresAt &&
              new Date(token.expiresAt).getTime() <= Date.now();
            const isRevoking = revokingId === token.id;

            return (
              <View key={token.id} style={styles.tokenCard}>
                <View style={styles.cardHeading}>
                  <View style={styles.flex}>
                    <Text style={styles.cardTitle}>
                      Overlay token
                    </Text>
                    <Text style={styles.muted}>
                      Dibuat: {formatDate(token.createdAt)}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.tokenStatus,
                      revoked || expired
                        ? styles.tokenInactive
                        : styles.tokenActive,
                    ]}
                  >
                    {revoked ? "Dicabut" : expired ? "Kedaluwarsa" : "Aktif"}
                  </Text>
                </View>

                <Text style={styles.fieldLabel}>Session ID</Text>
                <Text selectable style={styles.sessionId}>
                  {token.sessionId}
                </Text>

                {token.expiresAt && (
                  <Text style={styles.muted}>
                    Kedaluwarsa: {formatDate(token.expiresAt)}
                  </Text>
                )}

                {!revoked && !expired && (
                  <Pressable
                    accessibilityRole="button"
                    disabled={isRevoking}
                    onPress={() => confirmRevoke(token)}
                    style={({ pressed }) => [
                      styles.dangerButton,
                      pressed && styles.pressed,
                      isRevoking && styles.disabled,
                    ]}
                  >
                    {isRevoking ? (
                      <ActivityIndicator color={C.red} />
                    ) : (
                      <Text style={styles.dangerButtonText}>
                        Cabut token
                      </Text>
                    )}
                  </Pressable>
                )}
              </View>
            );
          })
        )}

        <Text style={styles.footerNote}>
          Jaga kerahasiaan URL Overlay. Siapa pun yang memiliki URL
          aktif berpotensi mengakses overlay tersebut.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.bg,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 40,
    gap: 18,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    backgroundColor: C.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 8,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  headerText: {
    flex: 1,
    gap: 3,
  },
  title: {
    color: C.text,
    fontSize: 25,
    fontWeight: "800",
  },
  muted: {
    color: C.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  card: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 20,
    padding: 18,
    gap: 15,
  },
  successCard: {
    backgroundColor: C.greenSoft,
    borderWidth: 1,
    borderColor: "#245b3b",
    borderRadius: 20,
    padding: 18,
    gap: 15,
  },
  tokenCard: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  cardHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: C.raised,
    alignItems: "center",
    justifyContent: "center",
  },
  flex: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  cardTitle: {
    color: C.text,
    fontSize: 16,
    fontWeight: "700",
  },
  bodyText: {
    color: C.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  sessionId: {
    color: C.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  platforms: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  platformChip: {
    backgroundColor: C.raised,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
  },
  platformText: {
    color: C.text,
    fontSize: 12,
    fontWeight: "600",
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: C.green,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 9,
  },
  primaryButtonText: {
    color: C.bg,
    fontSize: 15,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.72,
  },
  disabled: {
    opacity: 0.4,
  },
  fieldLabel: {
    color: C.subtle,
    fontSize: 12,
    fontWeight: "700",
  },
  url: {
    color: C.green,
    fontSize: 13,
    lineHeight: 20,
    backgroundColor: C.bg,
    borderRadius: 10,
    padding: 12,
    overflow: "hidden",
  },
  warning: {
    color: "#ffd18b",
    fontSize: 13,
    lineHeight: 19,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  sectionTitle: {
    color: C.text,
    fontSize: 20,
    fontWeight: "700",
  },
  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 8,
  },
  refreshText: {
    color: C.green,
    fontSize: 13,
    fontWeight: "600",
  },
  tokenStatus: {
    fontSize: 12,
    fontWeight: "700",
  },
  tokenActive: {
    color: C.green,
  },
  tokenInactive: {
    color: C.red,
  },
  dangerButton: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: C.redSoft,
    borderWidth: 1,
    borderColor: "#5c2e35",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  dangerButtonText: {
    color: C.red,
    fontSize: 14,
    fontWeight: "700",
  },
  errorBox: {
    backgroundColor: C.redSoft,
    borderWidth: 1,
    borderColor: "#5c2e35",
    borderRadius: 14,
    padding: 14,
    gap: 7,
  },
  errorTitle: {
    color: C.red,
    fontSize: 15,
    fontWeight: "700",
  },
  errorText: {
    color: "#f0b4ba",
    fontSize: 13,
    lineHeight: 19,
  },
  retry: {
    color: C.green,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 4,
  },
  footerNote: {
    color: C.subtle,
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: 2,
  },
});
