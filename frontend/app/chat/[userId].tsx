import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../src/theme';
import { useAuth } from '../../src/auth';

type Message = {
  id: string;
  from_user_id: string;
  to_user_id: string;
  from_role: string;
  from_name: string;
  text: string;
  source: 'app' | 'telegram';
  sent_at: string;
  read_at: string | null;
  ai_suggestion?: string | null;
  ai_confident?: boolean;
};

export default function ChatRoom() {
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { user, isAuthed, isAdmin, loading: authLoading, authFetch } = useAuth();

  const [messages, setMessages] = useState<Message[]>([]);
  const [otherName, setOtherName] = useState('');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dismissedSuggestionIds, setDismissedSuggestionIds] = useState<Set<string>>(new Set());
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!authLoading && !isAuthed) router.replace('/login');
  }, [authLoading, isAuthed, router]);

  const load = useCallback(async (auto = false) => {
    if (!userId) return;
    try {
      const r = await authFetch(`/chat/messages/${userId}`);
      if (r.ok) {
        const d = await r.json();
        setMessages(d.messages || []);
        setOtherName(d.other?.name || '');
        if (!auto) setLoading(false);
        // scroll to bottom on next tick
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: !auto }), 60);
      }
    } catch {}
    if (!auto) setLoading(false);
  }, [authFetch, userId]);

  useEffect(() => { if (isAuthed && userId) load(); }, [isAuthed, userId, load]);

  // Polling every 4s
  useEffect(() => {
    if (!isAuthed || !userId) return;
    const id = setInterval(() => load(true), 4000);
    return () => clearInterval(id);
  }, [isAuthed, userId, load]);

  // Latest INCOMING message that has an AI suggestion (admin only)
  const latestSuggestion = useMemo(() => {
    if (!isAdmin) return null;
    // Find the last message FROM the formando that hasn't been answered yet
    const lastTheir = [...messages].reverse().find((m) => m.from_user_id !== user?.id);
    if (!lastTheir) return null;
    if (!lastTheir.ai_suggestion) return null;
    if (dismissedSuggestionIds.has(lastTheir.id)) return null;
    // If the admin already replied AFTER this incoming message, hide the suggestion
    const lastTheirIdx = messages.findIndex((m) => m.id === lastTheir.id);
    const repliedAfter = messages
      .slice(lastTheirIdx + 1)
      .some((m) => m.from_user_id === user?.id);
    if (repliedAfter) return null;
    return lastTheir;
  }, [messages, isAdmin, user?.id, dismissedSuggestionIds]);

  const send = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || !userId) return;
    setSending(true);
    try {
      const r = await authFetch('/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to_user_id: userId, text }),
      });
      if (r.ok) {
        if (!overrideText) setInput('');
        await load();
      }
    } finally {
      setSending(false);
    }
  };

  const acceptSuggestion = () => {
    if (!latestSuggestion?.ai_suggestion) return;
    setInput(latestSuggestion.ai_suggestion);
  };
  const sendSuggestionAsIs = () => {
    if (!latestSuggestion?.ai_suggestion) return;
    send(latestSuggestion.ai_suggestion);
  };
  const dismissSuggestion = () => {
    if (!latestSuggestion) return;
    setDismissedSuggestionIds((prev) => new Set(prev).add(latestSuggestion.id));
  };

  const fmtTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
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
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()} testID="chat-room-back">
          <Ionicons name="arrow-back" size={22} color={theme.colors.secondary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.topbarTitle} numberOfLines={1}>{otherName}</Text>
          <Text style={styles.topbarSub}>{messages.length} mensagens</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: 12, paddingBottom: 16 }}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {messages.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="chatbubble-ellipses-outline" size={42} color={theme.colors.textLight} />
              <Text style={styles.emptyText}>Sem mensagens. Envie a primeira!</Text>
            </View>
          ) : (
            messages.map((m) => {
              const isMe = m.from_user_id === user?.id;
              return (
                <View key={m.id} style={[styles.bubbleRow, isMe ? { justifyContent: 'flex-end' } : undefined]}>
                  <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
                    <Text style={[styles.bubbleText, isMe && { color: '#fff' }]}>{m.text}</Text>
                    <View style={styles.bubbleMeta}>
                      <Text style={[styles.metaText, isMe && { color: 'rgba(255,255,255,0.75)' }]}>
                        {fmtTime(m.sent_at)}
                        {m.source === 'telegram' ? ' · 📱' : ''}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        {/* AI Suggestion banner (admin only) */}
        {!!latestSuggestion?.ai_suggestion && (
          <View style={styles.aiCard} testID="ai-suggestion-card">
            <View style={styles.aiHeader}>
              <View style={styles.aiBadge}>
                <Ionicons name="sparkles" size={12} color="#fff" />
                <Text style={styles.aiBadgeText}>Sugestão AI</Text>
              </View>
              {latestSuggestion.ai_confident ? (
                <View style={[styles.confPill, { backgroundColor: '#DCFCE7', borderColor: '#86EFAC' }]}>
                  <Text style={[styles.confPillText, { color: '#15803D' }]}>✓ Confiante</Text>
                </View>
              ) : (
                <View style={[styles.confPill, { backgroundColor: '#FEF3C7', borderColor: '#FCD34D' }]}>
                  <Text style={[styles.confPillText, { color: '#92400E' }]}>⚠ Reveja</Text>
                </View>
              )}
              <TouchableOpacity onPress={dismissSuggestion} style={styles.aiClose} testID="ai-dismiss">
                <Ionicons name="close" size={18} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={styles.aiText} selectable>{latestSuggestion.ai_suggestion}</Text>
            <View style={styles.aiActions}>
              <TouchableOpacity
                style={styles.aiBtnGhost}
                onPress={acceptSuggestion}
                testID="ai-edit"
              >
                <Ionicons name="create-outline" size={14} color={theme.colors.secondary} />
                <Text style={styles.aiBtnGhostText}>Editar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.aiBtnPrimary, sending && { opacity: 0.6 }]}
                onPress={sendSuggestionAsIs}
                disabled={sending}
                testID="ai-send"
              >
                <Ionicons name="send" size={14} color="#fff" />
                <Text style={styles.aiBtnPrimaryText}>Enviar tal e qual</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            placeholder="Escrever mensagem..."
            placeholderTextColor={theme.colors.textLight}
            value={input}
            onChangeText={setInput}
            multiline
            spellCheck
            autoCorrect
            testID="chat-input"
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || sending) && { opacity: 0.5 }]}
            onPress={() => send()}
            disabled={!input.trim() || sending}
            testID="chat-send"
          >
            {sending ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="send" size={18} color="#fff" />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  topbar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  iconBtn: {
    width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
    borderRadius: 4, backgroundColor: theme.colors.surfaceAlt,
  },
  topbarTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.secondary },
  topbarSub: { fontSize: 11, color: theme.colors.textMuted },
  empty: { padding: 80, alignItems: 'center', gap: 10 },
  emptyText: { fontSize: 13, color: theme.colors.textLight, textAlign: 'center' },
  bubbleRow: { flexDirection: 'row', marginBottom: 6 },
  bubble: { maxWidth: '75%', padding: 10, borderRadius: 12 },
  bubbleMe: { backgroundColor: theme.colors.primary, borderBottomRightRadius: 4 },
  bubbleThem: {
    backgroundColor: theme.colors.surface, borderBottomLeftRadius: 4,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  bubbleText: { fontSize: 14, color: theme.colors.textMain, lineHeight: 19 },
  bubbleMeta: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 },
  metaText: { fontSize: 10, color: theme.colors.textLight, fontWeight: '600' },
  composer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 10,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1, borderTopColor: theme.colors.border,
  },
  input: {
    flex: 1, minHeight: 42, maxHeight: 120,
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: 6,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
    color: theme.colors.textMain, backgroundColor: '#fff',
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: theme.colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  // AI suggestion card
  aiCard: {
    marginHorizontal: 10, marginBottom: 4, padding: 12,
    backgroundColor: '#F5F3FF',
    borderWidth: 1, borderColor: '#C4B5FD',
    borderRadius: 10, gap: 8,
  },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  aiBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#7C3AED', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4,
  },
  aiBadgeText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  confPill: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, borderWidth: 1,
  },
  confPillText: { fontSize: 10, fontWeight: '800' },
  aiClose: { marginLeft: 'auto', padding: 2 },
  aiText: {
    fontSize: 13, color: theme.colors.textMain, lineHeight: 19,
    backgroundColor: '#fff', padding: 10, borderRadius: 6,
    borderWidth: 1, borderColor: '#E9D5FF',
  },
  aiActions: { flexDirection: 'row', gap: 8 },
  aiBtnGhost: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 9,
    borderWidth: 1, borderColor: theme.colors.secondary, borderRadius: 4,
  },
  aiBtnGhostText: { color: theme.colors.secondary, fontWeight: '800', fontSize: 12 },
  aiBtnPrimary: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 9,
    backgroundColor: '#7C3AED', borderRadius: 4,
  },
  aiBtnPrimaryText: { color: '#fff', fontWeight: '800', fontSize: 12 },
});
