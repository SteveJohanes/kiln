import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useState } from "react";
import { router } from "expo-router";
import { useAuth } from "../../lib/auth-context";

export default function LoginScreen() {
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password) {
      Alert.alert(
        "Login",
        "Email dan password harus diisi.",
      );
      return;
    }

    try {
      setIsSubmitting(true);

      await login(email.trim(), password);

      router.replace("/");
    } catch {
      Alert.alert(
        "Login gagal",
        "Email atau password salah.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.logo}>KILN</Text>

        <Text style={styles.title}>
          Selamat datang kembali
        </Text>

        <Text style={styles.subtitle}>
          Login untuk mengakses dashboard livestream kamu.
        </Text>

        <View style={styles.form}>
          <Text style={styles.label}>Email</Text>

          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Masukkan email"
            placeholderTextColor="#777"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            editable={!isSubmitting}
            style={styles.input}
          />

          <Text style={styles.label}>Password</Text>

          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Masukkan password"
            placeholderTextColor="#777"
            secureTextEntry
            editable={!isSubmitting}
            style={styles.input}
          />

          <Pressable
            onPress={() => {
              void handleLogin();
            }}
            disabled={isSubmitting}
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
              isSubmitting && styles.buttonDisabled,
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>
                Login
              </Text>
            )}
          </Pressable>
        </View>

        <Text style={styles.demoText}>
          Demo: demo@kiln.app / kiln123
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f1115",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
    backgroundColor: "#181b21",
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: "#2a2f38",
  },
  logo: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 4,
    marginBottom: 24,
  },
  title: {
    color: "#ffffff",
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 8,
  },
  subtitle: {
    color: "#9da3ae",
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 28,
  },
  form: {
    gap: 10,
  },
  label: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 4,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: "#343a45",
    borderRadius: 12,
    backgroundColor: "#111318",
    color: "#ffffff",
    paddingHorizontal: 15,
    fontSize: 15,
    marginBottom: 8,
  },
  button: {
    height: 50,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: "#111318",
    fontSize: 15,
    fontWeight: "700",
  },
  demoText: {
    color: "#666d78",
    fontSize: 12,
    textAlign: "center",
    marginTop: 20,
  },
});