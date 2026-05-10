import React, { useState, useEffect, useCallback, useRef } from 'react';
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
};

export default function ChatRoom() {
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { user, isAuthed, loading: authLoading, authFetch } = useAuth();

  const [messages, setMessages] = useState<Message[]>([]);
  const [otherName, setOtherName] = useState('');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
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

  const send = async () => {
    const text = input.trim();
    if (!text || !userId) return;
    setSending(true);
    try {
      const r = await authFetch('/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to_user_id: userId, text }),
      });
      if (r.ok) {
        setInput('');
        await load();
      }
    } finally {
      setSending(false);
    }
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
            onPress={send}
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
});
