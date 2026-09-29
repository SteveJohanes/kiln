import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { useState } from "react";
import { useAuth } from "../lib/auth-context";

function formatCreatedAt(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(
    "id-ID",
    {
      day: "2-digit",
      month: "long",
      year: "numeric",
    },
  );
}

export default function AccountScreen() {
  const {
    user,
    logout,
  } = useAuth();

  const [loggingOut, setLoggingOut] =
    useState(false);

  async function handleLogout() {
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

      await logout();
    } catch (error) {
      console.error(
        "Gagal melakukan logout:",
        error,
      );
    } finally {
      setLoggingOut(false);
    }
  }

  if (!user) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" />

        <Text style={styles.loadingText}>
          Memuat akun...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.backText}>
            ‹
          </Text>
        </Pressable>

        <Text style={styles.headerTitle}>
          Account
        </Text>

        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user.email
              .charAt(0)
              .toUpperCase()}
          </Text>
        </View>

        <Text style={styles.email}>
          {user.email}
        </Text>

        <Text style={styles.accountLabel}>
          Kiln Account
        </Text>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.cardTitle}>
          Informasi Akun
        </Text>

        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>
            Email
          </Text>

          <Text style={styles.infoValue}>
            {user.email}
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>
            User ID
          </Text>

          <Text
            style={styles.infoValue}
            numberOfLines={1}
          >
            {user.id}
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>
            Dibuat
          </Text>

          <Text style={styles.infoValue}>
            {formatCreatedAt(
              user.createdAt,
            )}
          </Text>
        </View>
      </View>

      <Pressable
        onPress={() => {
          void handleLogout();
        }}
        disabled={loggingOut}
        style={({ pressed }) => [
          styles.logoutButton,
          pressed && styles.buttonPressed,
          loggingOut &&
            styles.buttonDisabled,
        ]}
      >
        {loggingOut ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.logoutText}>
            Keluar dari Akun
          </Text>
        )}
      </Pressable>
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
    paddingTop: 55,
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
    color: "#aeb4bf",
    fontSize: 14,
    marginTop: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#181b21",
    borderWidth: 1,
    borderColor: "#292e38",
    alignItems: "center",
    justifyContent: "center",
  },
  backText: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "300",
    lineHeight: 30,
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "800",
  },
  headerSpacer: {
    width: 42,
  },
  profileCard: {
    alignItems: "center",
    backgroundColor: "#181b21",
    borderWidth: 1,
    borderColor: "#292e38",
    borderRadius: 20,
    padding: 28,
    marginBottom: 14,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  avatarText: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "800",
  },
  email: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
  },
  accountLabel: {
    color: "#7f8795",
    fontSize: 13,
    marginTop: 5,
  },
  infoCard: {
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
    marginBottom: 18,
  },
  infoItem: {
    paddingVertical: 4,
  },
  infoLabel: {
    color: "#7f8795",
    fontSize: 12,
    marginBottom: 5,
  },
  infoValue: {
    color: "#e7e9ed",
    fontSize: 14,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    backgroundColor: "#292e38",
    marginVertical: 15,
  },
  logoutButton: {
    minHeight: 50,
    borderRadius: 12,
    backgroundColor: "#dc3545",
    alignItems: "center",
    justifyContent: "center",
  },
  logoutText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});