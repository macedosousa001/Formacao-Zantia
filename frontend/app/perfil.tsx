import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../src/theme';
import { useAuth } from '../src/auth';

type Attempt = {
  id: string;
  entity_title: string;
  score: number;
  total: number;
  completed_at: string;
};

export default function Perfil() {
  const router = useRouter();
  const { user, isAuthed, loading: authLoading, refresh, logout, authFetch } = useAuth();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [stats, setStats] = useState({ score_total: 0, tests_taken: 0, average_percent: 0 });
  const [tgUrl, setTgUrl] = useState<string | null>(null);
  const [tgLoading, setTgLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthed) router.replace('/login');
  }, [authLoading, isAuthed, router]);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setPhone(user.phone || '');
    }
  }, [user]);

  const loadAttempts = useCallback(async () => {
    try {
      const r = await authFetch('/auth/quiz-attempts/me');
      if (r.ok) {
        const d = await r.json();
        setAttempts(d.attempts || []);
        setStats({
          score_total: d.score_total || 0,
          tests_taken: d.tests_taken || 0,
          average_percent: d.average_percent || 0,
        });
      }
    } catch (e) {
      console.log(e);
    }
  }, [authFetch]);

  useEffect(() => { if (isAuthed) loadAttempts(); }, [isAuthed, loadAttempts]);

  const save = async () => {
    setSaving(true);
    try {
      const body: any = { name: name.trim(), phone: phone.trim() };
      if (password) body.password = password;
      const r = await authFetch('/auth/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) {
        Alert.alert('Erro', d.detail || 'Não foi possível guardar');
        return;
      }
      setPassword('');
      await refresh();
      Alert.alert('Guardado', 'Os seus dados foram atualizados.');
    } catch {
      Alert.alert('Erro', 'Erro de rede');
    } finally {
      setSaving(false);
    }
  };

  const linkTelegram = async () => {
    setTgLoading(true);
    try {
      const r = await authFetch('/auth/telegram-link');
      const d = await r.json();
      if (!r.ok) {
        Alert.alert('Erro', d.detail || 'Não foi possível obter o link');
        return;
      }
      setTgUrl(d.url);
      try {
        await Linking.openURL(d.url);
      } catch {
        // some webviews block; user can copy manually
      }
    } catch {
      Alert.alert('Erro', 'Erro de rede');
    } finally {
      setTgLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return iso;
    }
  };

  if (authLoading || !user) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topbar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()} testID="profile-back">
          <Ionicons name="arrow-back" size={22} color={theme.colors.secondary} />
        </TouchableOpacity>
        <Text style={styles.topbarTitle}>O Meu Perfil</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
          {/* Header card */}
          <View style={styles.headerCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(user.name || user.email).charAt(0).toUpperCase()}</Text>
            </View>
            <Text style={styles.uName}>{user.name || user.email}</Text>
            <Text style={styles.uEmail}>{user.email}</Text>
            <View style={styles.badgeRow}>
              <View style={[styles.badge, { backgroundColor: user.role === 'admin' ? theme.colors.primary : theme.colors.secondary }]}>
                <Text style={styles.badgeText}>{user.role === 'admin' ? 'ADMIN' : 'FORMANDO'}</Text>
              </View>
              <View style={[styles.badge, {
                backgroundColor: user.status === 'approved' ? '#16A34A'
                  : user.status === 'pending' ? '#D97706' : '#991B1B',
              }]}>
                <Text style={styles.badgeText}>
                  {user.status === 'approved' ? 'APROVADO' : user.status === 'pending' ? 'PENDENTE' : 'REJEITADO'}
                </Text>
              </View>
            </View>
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.score_total}</Text>
              <Text style={styles.statLabel}>pontos</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.tests_taken}</Text>
              <Text style={styles.statLabel}>testes</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.average_percent}%</Text>
              <Text style={styles.statLabel}>média</Text>
            </View>
          </View>

          {/* Edit form */}
          <Text style={styles.sectionTitle}>Dados Pessoais</Text>
          <View style={styles.formCard}>
            <Text style={styles.label}>Nome</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="O seu nome"
              placeholderTextColor={theme.colors.textLight}
              spellCheck
              autoCorrect
              testID="profile-name"
            />
            <Text style={styles.label}>Telemóvel</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="912345678"
              placeholderTextColor={theme.colors.textLight}
              keyboardType="phone-pad"
              testID="profile-phone"
            />
            <Text style={styles.label}>Nova palavra-passe (opcional)</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Deixe vazio para manter"
              placeholderTextColor={theme.colors.textLight}
              secureTextEntry
              testID="profile-password"
            />
            <TouchableOpacity
              style={[styles.primaryBtn, saving && { opacity: 0.6 }]}
              onPress={save}
              disabled={saving}
              testID="profile-save"
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Guardar alterações</Text>}
            </TouchableOpacity>
          </View>

          {/* Telegram */}
          <Text style={styles.sectionTitle}>Telegram</Text>
          <View style={styles.formCard}>
            {user.telegram_linked ? (
              <View style={styles.tgLinked}>
                <Ionicons name="checkmark-circle" size={22} color="#16A34A" />
                <Text style={styles.tgLinkedText}>Telegram ligado · receberá notificações automáticas</Text>
              </View>
            ) : (
              <>
                <Text style={styles.tgInfo}>
                  Ligue o seu Telegram para receber notificações de aprovação e mensagens importantes.
                </Text>
                <TouchableOpacity
                  style={[styles.tgBtn, tgLoading && { opacity: 0.6 }]}
                  onPress={linkTelegram}
                  disabled={tgLoading}
                  testID="profile-tg-link"
                >
                  {tgLoading ? <ActivityIndicator color="#fff" /> : (
                    <>
                      <Ionicons name="paper-plane" size={16} color="#fff" />
                      <Text style={styles.tgBtnText}>Ligar Telegram</Text>
                    </>
                  )}
                </TouchableOpacity>
                {!!tgUrl && (
                  <Text style={styles.tgUrl} selectable>{tgUrl}</Text>
                )}
              </>
            )}
          </View>

          {/* History */}
          <Text style={styles.sectionTitle}>Histórico de Testes</Text>
          {attempts.length === 0 ? (
            <Text style={styles.emptyText}>Ainda não realizou testes.</Text>
          ) : (
            attempts.slice(0, 20).map((a) => (
              <View key={a.id} style={styles.historyRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.histTitle}>{a.entity_title || 'Teste'}</Text>
                  <Text style={styles.histDate}>{formatDate(a.completed_at)}</Text>
                </View>
                <Text style={styles.histScore}>{a.score}/{a.total}</Text>
              </View>
            ))
          )}

          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} testID="profile-logout">
            <Ionicons name="log-out-outline" size={18} color="#991B1B" />
            <Text style={styles.logoutText}>Terminar sessão</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  topbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  iconBtn: {
    width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
    borderRadius: 4, backgroundColor: theme.colors.surfaceAlt,
  },
  topbarTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.secondary },
  headerCard: {
    backgroundColor: theme.colors.surface, padding: 20, borderRadius: 10,
    alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border,
  },
  avatar: {
    width: 70, height: 70, borderRadius: 35, backgroundColor: theme.colors.primary,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  avatarText: { color: '#fff', fontWeight: '900', fontSize: 28 },
  uName: { fontSize: 18, fontWeight: '800', color: theme.colors.secondary },
  uEmail: { fontSize: 13, color: theme.colors.textMuted, marginTop: 2 },
  badgeRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  statCard: {
    flex: 1, backgroundColor: theme.colors.surface, padding: 14, borderRadius: 8,
    alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border,
  },
  statValue: { fontSize: 22, fontWeight: '900', color: theme.colors.primary },
  statLabel: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2, letterSpacing: 1 },
  sectionTitle: {
    fontSize: 12, fontWeight: '800', color: theme.colors.secondary,
    letterSpacing: 2, marginTop: 24, marginBottom: 10,
  },
  formCard: {
    backgroundColor: theme.colors.surface, padding: 16, borderRadius: 8,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  label: { fontSize: 12, fontWeight: '700', color: theme.colors.secondary, marginBottom: 6, marginTop: 10 },
  input: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: 6,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: theme.colors.textMain,
  },
  primaryBtn: {
    backgroundColor: theme.colors.primary, paddingVertical: 12, borderRadius: 4,
    alignItems: 'center', marginTop: 16,
  },
  primaryBtnText: { color: '#fff', fontWeight: '800' },
  tgLinked: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tgLinkedText: { fontSize: 13, color: '#16A34A', fontWeight: '700', flex: 1 },
  tgInfo: { fontSize: 13, color: theme.colors.textMuted, lineHeight: 18, marginBottom: 12 },
  tgBtn: {
    flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#0088cc', paddingVertical: 12, borderRadius: 4,
  },
  tgBtnText: { color: '#fff', fontWeight: '800' },
  tgUrl: { fontSize: 11, color: theme.colors.textMuted, marginTop: 8, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  emptyText: { fontSize: 13, color: theme.colors.textLight, fontStyle: 'italic' },
  historyRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface,
    padding: 12, borderRadius: 6, borderWidth: 1, borderColor: theme.colors.border,
    marginBottom: 6,
  },
  histTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.textMain },
  histDate: { fontSize: 11, color: theme.colors.textLight, marginTop: 2 },
  histScore: { fontSize: 16, fontWeight: '900', color: theme.colors.primary },
  logoutBtn: {
    flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, marginTop: 24,
    borderWidth: 1, borderColor: '#FCA5A5', borderRadius: 4, backgroundColor: '#FEF2F2',
  },
  logoutText: { color: '#991B1B', fontWeight: '800' },
});
