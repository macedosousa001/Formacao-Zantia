import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../src/theme';
import { useAuth } from '../../src/auth';

type Conversation = {
  user_id: string;
  name: string;
  first_name?: string;
  last_name?: string;
  country?: string;
  status?: string;
  telegram_linked?: boolean;
  last_seen?: string | null;
  last_message?: string | null;
  last_at?: string | null;
  last_from?: string | null;
  unread: number;
};

export default function ChatList() {
  const router = useRouter();
  const { user, isAuthed, loading: authLoading, authFetch } = useAuth();
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthed) router.replace('/login');
  }, [authLoading, isAuthed, router]);

  const load = useCallback(async () => {
    try {
      const r = await authFetch('/chat/conversations');
      if (r.ok) setConvs(await r.json());
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, [authFetch]);

  useEffect(() => { if (isAuthed) load(); }, [isAuthed, load]);

  // Auto-refresh every 8s
  useEffect(() => {
    if (!isAuthed) return;
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, [isAuthed, load]);

  const fmtTime = (iso: string | null | undefined) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      const now = new Date();
      const sameDay = d.toDateString() === now.toDateString();
      if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return d.toLocaleDateString();
    } catch { return ''; }
  };

  const isOnline = (lastSeen: string | null | undefined) => {
    if (!lastSeen) return false;
    try {
      return Date.now() - new Date(lastSeen).getTime() < 5 * 60 * 1000;
    } catch { return false; }
  };

  if (authLoading || loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topbar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()} testID="chat-back">
          <Ionicons name="arrow-back" size={22} color={theme.colors.secondary} />
        </TouchableOpacity>
        <Text style={styles.topbarTitle}>Mensagens</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 12, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        {convs.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="chatbubbles-outline" size={48} color={theme.colors.textLight} />
            <Text style={styles.emptyTitle}>
              {user?.role === 'admin' ? 'Sem formandos' : 'Sem mensagens'}
            </Text>
            <Text style={styles.emptyText}>
              {user?.role === 'admin'
                ? 'Quando houver formandos registados, aparecerão aqui.'
                : 'Comece uma conversa com o administrador.'}
            </Text>
          </View>
        ) : (
          convs.map((c) => (
            <TouchableOpacity
              key={c.user_id}
              style={styles.row}
              onPress={() => router.push(`/chat/${c.user_id}`)}
              testID={`chat-conv-${c.user_id}`}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{(c.name || '?').charAt(0).toUpperCase()}</Text>
                {isOnline(c.last_seen) && <View style={styles.onlineDot} />}
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={styles.headerRow}>
                  <Text style={styles.name} numberOfLines={1}>{c.name || 'Utilizador'}</Text>
                  <Text style={styles.time}>{fmtTime(c.last_at)}</Text>
                </View>
                <View style={styles.subRow}>
                  <Text style={styles.lastMsg} numberOfLines={1}>
                    {c.last_message
                      ? (c.last_from === user?.id ? 'Você: ' : '') + c.last_message
                      : <Text style={{ fontStyle: 'italic', color: theme.colors.textLight }}>Sem mensagens</Text>}
                  </Text>
                  {c.unread > 0 && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadText}>{c.unread}</Text>
                    </View>
                  )}
                </View>
                {user?.role === 'admin' && (
                  <View style={styles.metaRow}>
                    {c.country ? <Text style={styles.metaChip}>🌍 {c.country}</Text> : null}
                    {c.telegram_linked ? (
                      <Text style={[styles.metaChip, { color: '#0088cc' }]}>📱 Telegram</Text>
                    ) : null}
                    {c.status === 'pending' ? (
                      <Text style={[styles.metaChip, { color: '#D97706' }]}>⏳ Pendente</Text>
                    ) : null}
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
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
  empty: { padding: 60, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.secondary, marginTop: 12 },
  emptyText: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', lineHeight: 18 },
  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface,
    padding: 12, borderRadius: 8, marginBottom: 8,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  avatar: {
    width: 50, height: 50, borderRadius: 25, backgroundColor: theme.colors.secondary,
    alignItems: 'center', justifyContent: 'center', position: 'relative',
  },
  avatarText: { color: '#fff', fontWeight: '900', fontSize: 22 },
  onlineDot: {
    position: 'absolute', bottom: 0, right: 0, width: 12, height: 12,
    borderRadius: 6, backgroundColor: '#16A34A', borderWidth: 2, borderColor: '#fff',
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6 },
  name: { fontSize: 15, fontWeight: '800', color: theme.colors.secondary, flex: 1 },
  time: { fontSize: 11, color: theme.colors.textLight },
  subRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3, gap: 6 },
  lastMsg: { fontSize: 13, color: theme.colors.textMuted, flex: 1 },
  unreadBadge: {
    minWidth: 20, height: 20, borderRadius: 10, backgroundColor: theme.colors.primary,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
  },
  unreadText: { color: '#fff', fontWeight: '900', fontSize: 11 },
  metaRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  metaChip: { fontSize: 10, color: theme.colors.textLight, fontWeight: '700' },
});
