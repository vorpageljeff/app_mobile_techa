// src/screens/ProfileScreen.tsx
import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { DEFAULT_API_URL } from "@/services/api";
import { useAuthStore } from "@/store/auth";
import { useI18nStore } from "@/store/i18n";

const PLAN_LABELS = {
  free:       { label: "Free",       color: "#5F5E5A", bg: "#F1EFE8" },
  pro:        { label: "Pro",        color: "#27500A", bg: "#EAF3DE" },
  enterprise: { label: "Enterprise", color: "#0C447C", bg: "#E6F1FB" },
  admin:      { label: "Admin",      color: "#712B13", bg: "#FAECE7" },
};

function Avatar({ name }: { name: string }) {
  const initials = name.split(" ").slice(0, 2).map((w: string) => w[0]?.toUpperCase() ?? "").join("");
  return (
    <View style={styles.avatarCircle}>
      <Text style={styles.avatarText}>{initials}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const t = useI18nStore(state => state.t);
  const [loggingOut, setLoggingOut] = useState(false);
  const plan = PLAN_LABELS[user?.plan ?? "free"] ?? PLAN_LABELS.free;

  async function handleLogout() {
    Alert.alert("Sair da conta", "Tem certeza que deseja sair?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Sair", style: "destructive", onPress: async () => {
        setLoggingOut(true);
        try { await logout(); } finally { setLoggingOut(false); }
      }},
    ]);
  }

  if (!user) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Avatar name={user.name} />
        <Text style={styles.name}>{user.name}</Text>
        <Text style={styles.email}>{user.email}</Text>
        <View style={[styles.planBadge, { backgroundColor: plan.bg }]}>
          <Text style={[styles.planText, { color: plan.color }]}>{plan.label}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Conta</Text>
        <View style={styles.row}><Text style={styles.rowLabel}>Nome</Text><Text style={styles.rowValue}>{user.name}</Text></View>
        <View style={styles.divider} />
        <View style={styles.row}><Text style={styles.rowLabel}>Email</Text><Text style={styles.rowValue}>{user.email}</Text></View>
        <View style={styles.divider} />
        <View style={styles.row}><Text style={styles.rowLabel}>Plano</Text><View style={[styles.planBadgeSm, { backgroundColor: plan.bg }]}><Text style={[styles.planTextSm, { color: plan.color }]}>{plan.label}</Text></View></View>
        <View style={styles.divider} />
        <TouchableOpacity
          style={styles.actionRow}
          onPress={() => router.push('/auth/change-password')}
          accessibilityRole="button"
          accessibilityLabel={t('profile.changePassword')}
        >
          <View style={styles.actionLabel}>
            <Ionicons name="key-outline" size={20} color="#27500A" />
            <Text style={styles.actionText}>{t('profile.changePassword')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#888780" />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Techa</Text>
        <View style={styles.row}><Text style={styles.rowLabel}>Versao</Text><Text style={styles.rowValue}>1.0.0</Text></View>
        <View style={styles.divider} />
        <View style={styles.row}><Text style={styles.rowLabel}>Servidor</Text><Text style={styles.rowValue}>{DEFAULT_API_URL.replace('/api/v1', '')}</Text></View>
        <View style={styles.divider} />
        <View style={styles.row}><Text style={styles.rowLabel}>Satelite</Text><Text style={styles.rowValue}>Sentinel-2 L2A</Text></View>
        <View style={styles.divider} />
        <View style={styles.row}><Text style={styles.rowLabel}>Resolucao</Text><Text style={styles.rowValue}>2.5m/pixel (4x)</Text></View>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} disabled={loggingOut}>
        {loggingOut ? <ActivityIndicator color="#A32D2D" /> : <Text style={styles.logoutText}>Sair da conta</Text>}
      </TouchableOpacity>

      <Text style={styles.footer}>Techa by InnovAgro Py{"\n"}Hernandarias, Alto Parana, Paraguay</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9F8F4" },
  content: { paddingBottom: 48 },
  header: { alignItems: "center", paddingTop: 40, paddingBottom: 28, backgroundColor: "#fff", borderBottomWidth: 0.5, borderBottomColor: "#E0DED8" },
  avatarCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#1A3A0A", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  avatarText: { color: "#fff", fontSize: 28, fontWeight: "600" },
  name: { fontSize: 20, fontWeight: "600", color: "#1A1A18", marginBottom: 4 },
  email: { fontSize: 14, color: "#888780", marginBottom: 10 },
  planBadge: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20 },
  planText: { fontSize: 13, fontWeight: "600" },
  section: { marginTop: 20, marginHorizontal: 16, backgroundColor: "#fff", borderRadius: 12, borderWidth: 0.5, borderColor: "#E0DED8", overflow: "hidden" },
  sectionTitle: { fontSize: 12, fontWeight: "500", color: "#888780", textTransform: "uppercase", letterSpacing: 0.5, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  rowLabel: { fontSize: 14, color: "#5F5E5A" },
  rowValue: { fontSize: 14, color: "#1A1A18", maxWidth: "60%", textAlign: "right" },
  actionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14 },
  actionLabel: { flexDirection: "row", alignItems: "center", gap: 10 },
  actionText: { fontSize: 14, color: "#27500A", fontWeight: "600" },
  divider: { height: 0.5, backgroundColor: "#E0DED8", marginHorizontal: 16 },
  planBadgeSm: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  planTextSm: { fontSize: 12, fontWeight: "600" },
  logoutBtn: { marginTop: 28, marginHorizontal: 16, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: "#F7C1C1", backgroundColor: "#FCEBEB", alignItems: "center" },
  logoutText: { color: "#A32D2D", fontSize: 15, fontWeight: "600" },
  footer: { marginTop: 32, textAlign: "center", fontSize: 12, color: "#BDBBB5", lineHeight: 18 },
});
