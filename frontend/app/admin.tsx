import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Modal, TextInput, Image,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { theme, API_URL } from '../src/theme';
import PromptModal from '../src/PromptModal';
import { useAuth } from '../src/auth';

type Gavetao = { id: string; title: string; subtitle: string; image_url: string; gavetinhas: any[] };
type AdminUser = {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: 'admin' | 'formando';
  status: 'pending' | 'approved' | 'rejected';
  score_total?: number;
  telegram_chat_id?: string | null;
};

export default function Admin() {
  const router = useRouter();
  const { isAdmin, loading: authLoading, authFetch } = useAuth();

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.replace('/login');
    }
  }, [authLoading, isAdmin, router]);

  const [tab, setTab] = useState<'gavetoes' | 'pending' | 'users'>('gavetoes');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [online, setOnline] = useState<{ online_count: number; users: any[] }>({ online_count: 0, users: [] });
  const [data, setData] = useState<Gavetao[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [createGavetaoId, setCreateGavetaoId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<Gavetao | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editSubtitle, setEditSubtitle] = useState('');
  const [editImage, setEditImage] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [renameGavetinha, setRenameGavetinha] = useState<{ id: string; title: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/gavetoes`);
      setData(await r.json());
    } finally { setLoading(false); }
  }, []);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const r = await authFetch('/auth/users');
      if (r.ok) {
        setUsers(await r.json());
      }
    } finally { setUsersLoading(false); }
  }, [authFetch]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (isAdmin && (tab === 'pending' || tab === 'users')) loadUsers(); }, [tab, isAdmin, loadUsers]);

  const userAction = async (uid: string, action: 'approve' | 'reject' | 'promote' | 'demote') => {
    try {
      const r = await authFetch(`/auth/users/${uid}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        Alert.alert('Erro', d.detail || 'Ação falhou');
        return;
      }
      loadUsers();
    } catch {
      Alert.alert('Erro', 'Erro de rede');
    }
  };

  const confirmDelete = (msg: string, onOk: () => void) => {
    if (typeof window !== 'undefined' && window.confirm) {
      if (window.confirm(msg)) onOk();
    } else {
      Alert.alert('Confirmar', msg, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: onOk },
      ]);
    }
  };

  const delGavetao = (id: string, title: string) => {
    confirmDelete(`Eliminar gavetão "${title}" e todo o seu conteúdo?`, async () => {
      await fetch(`${API_URL}/gavetoes/${id}`, { method: 'DELETE' });
      load();
    });
  };

  const delGavetinha = (id: string, title: string) => {
    confirmDelete(`Eliminar "${title}"?`, async () => {
      await fetch(`${API_URL}/gavetinhas/${id}`, { method: 'DELETE' });
      load();
    });
  };

  const createGavetao = async (title: string, subtitle?: string) => {
    setCreateOpen(false);
    await fetch(`${API_URL}/gavetoes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, subtitle: subtitle || '' }),
    });
    load();
  };

  const createGavetinha = async (title: string) => {
    if (!createGavetaoId) return;
    const gid = createGavetaoId;
    setCreateGavetaoId(null);
    await fetch(`${API_URL}/gavetinhas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gavetao_id: gid, title, description: '' }),
    });
    load();
  };

  const openEdit = (g: Gavetao) => {
    setEditTarget(g);
    setEditTitle(g.title);
    setEditSubtitle(g.subtitle || '');
    setEditImage(g.image_url || '');
  };

  const pickEditImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permissão necessária', 'Precisamos de acesso às imagens.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0];
      const mime = a.mimeType || 'image/jpeg';
      setEditImage(a.base64 ? `data:${mime};base64,${a.base64}` : a.uri);
    }
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    setSavingEdit(true);
    try {
      await fetch(`${API_URL}/gavetoes/${editTarget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle, subtitle: editSubtitle, image_url: editImage }),
      });
      setEditTarget(null);
      load();
    } catch {
      Alert.alert('Erro', 'Não foi possível guardar.');
    } finally {
      setSavingEdit(false);
    }
  };

  const submitRenameGavetinha = async (newTitle: string) => {
    if (!renameGavetinha) return;
    const id = renameGavetinha.id;
    setRenameGavetinha(null);
    try {
      await fetch(`${API_URL}/gavetinhas/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle }),
      });
      load();
    } catch {
      Alert.alert('Erro', 'Não foi possível renomear.');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topbar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()} testID="back-button">
          <Ionicons name="arrow-back" size={22} color={theme.colors.secondary} />
        </TouchableOpacity>
        <Text style={styles.topbarTitle}>Administração</Text>
        {tab === 'gavetoes' ? (
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: theme.colors.primary }]}
            onPress={() => setCreateOpen(true)}
            testID="admin-add-gavetao"
          >
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'gavetoes' && styles.tabActive]}
          onPress={() => setTab('gavetoes')}
          testID="admin-tab-gavetoes"
        >
          <Ionicons name="albums-outline" size={16} color={tab === 'gavetoes' ? '#fff' : theme.colors.secondary} />
          <Text style={[styles.tabText, tab === 'gavetoes' && styles.tabTextActive]}>Gavetões</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'pending' && styles.tabActive]}
          onPress={() => setTab('pending')}
          testID="admin-tab-pending"
        >
          <Ionicons name="time-outline" size={16} color={tab === 'pending' ? '#fff' : theme.colors.secondary} />
          <Text style={[styles.tabText, tab === 'pending' && styles.tabTextActive]}>
            Pendentes{users.filter(u => u.status === 'pending').length ? ` (${users.filter(u => u.status === 'pending').length})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'users' && styles.tabActive]}
          onPress={() => setTab('users')}
          testID="admin-tab-users"
        >
          <Ionicons name="people-outline" size={16} color={tab === 'users' ? '#fff' : theme.colors.secondary} />
          <Text style={[styles.tabText, tab === 'users' && styles.tabTextActive]}>Utilizadores</Text>
        </TouchableOpacity>
      </View>

      {tab === 'gavetoes' && (loading ? (
        <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: 60 }}>
          <Text style={styles.intro}>
            Gira os {data.length} gavetões e os seus conteúdos. Toque num item para ver detalhes ou usar as ações.
          </Text>
          {data.map((g) => (
            <View key={g.id} style={styles.card}>
              <TouchableOpacity
                style={styles.cardHeader}
                onPress={() => setExpanded((e) => ({ ...e, [g.id]: !e[g.id] }))}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{g.title}</Text>
                  <Text style={styles.cardSub}>{g.gavetinhas.length} itens · {g.subtitle}</Text>
                </View>
                <Ionicons
                  name={expanded[g.id] ? 'chevron-up' : 'chevron-down'}
                  size={20} color={theme.colors.secondary}
                />
              </TouchableOpacity>

              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => router.push(`/gavetao/${g.id}`)}
                >
                  <Ionicons name="eye-outline" size={16} color={theme.colors.secondary} />
                  <Text style={styles.actionText}>Ver</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => openEdit(g)}
                  testID={`admin-edit-gavetao-${g.id}`}
                >
                  <Ionicons name="create-outline" size={16} color={theme.colors.accent} />
                  <Text style={[styles.actionText, { color: theme.colors.accent }]}>Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => setCreateGavetaoId(g.id)}
                  testID={`admin-add-gavetinha-${g.id}`}
                >
                  <Ionicons name="add-circle-outline" size={16} color={theme.colors.primary} />
                  <Text style={[styles.actionText, { color: theme.colors.primary }]}>Gavetinha</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => delGavetao(g.id, g.title)}
                  testID={`admin-del-gavetao-${g.id}`}
                >
                  <Ionicons name="trash-outline" size={16} color="#991B1B" />
                  <Text style={[styles.actionText, { color: '#991B1B' }]}>Eliminar</Text>
                </TouchableOpacity>
              </View>

              {expanded[g.id] && (
                <View style={styles.children}>
                  {g.gavetinhas.length === 0 && (
                    <Text style={styles.emptyText}>Sem gavetinhas. Adicione a primeira.</Text>
                  )}
                  {g.gavetinhas.map((gv: any) => (
                    <View key={gv.id} style={styles.childRow}>
                      <TouchableOpacity
                        style={{ flex: 1 }}
                        onPress={() => router.push(`/gavetinha/${gv.id}`)}
                      >
                        <Text style={styles.childTitle}>{gv.title}</Text>
                        <Text style={styles.childMeta}>
                          {gv.images?.length || 0} img · {gv.videos?.length || 0} vid
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setRenameGavetinha({ id: gv.id, title: gv.title })}
                        style={[styles.childDel, { backgroundColor: '#FFF7ED' }]}
                        testID={`admin-rename-gavetinha-${gv.id}`}
                      >
                        <Ionicons name="create-outline" size={16} color={theme.colors.accent} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => delGavetinha(gv.id, gv.title)}
                        style={styles.childDel}
                        testID={`admin-del-gavetinha-${gv.id}`}
                      >
                        <Ionicons name="trash-outline" size={16} color="#991B1B" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      ))}

      {tab === 'pending' && (
        <ScrollView contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: 60 }}>
          <View style={styles.onlineBanner}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>
              <Text style={{ fontWeight: '900' }}>{online.online_count}</Text> {online.online_count === 1 ? 'utilizador online agora' : 'utilizadores online agora'}
            </Text>
            {online.users.slice(0, 3).map((u: any) => (
              <View key={u.id} style={styles.onlineChip}>
                <Text style={styles.onlineChipText}>{u.name}</Text>
              </View>
            ))}
            {online.users.length > 3 && (
              <Text style={styles.onlineMore}>+{online.users.length - 3}</Text>
            )}
          </View>
          <Text style={styles.intro}>
            Utilizadores aguardando aprovação. Aprove para conceder acesso completo, ou rejeite para bloquear.
          </Text>
          {usersLoading ? (
            <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 40 }} />
          ) : (
            (() => {
              const pending = users.filter(u => u.status === 'pending');
              if (pending.length === 0) {
                return <Text style={styles.emptyText}>Sem utilizadores pendentes.</Text>;
              }
              return pending.map(u => (
                <View key={u.id} style={styles.userCard} testID={`pending-user-${u.id}`}>
                  <View style={styles.userInfo}>
                    <View style={styles.userAvatar}>
                      <Text style={styles.userAvatarText}>{(u.name || u.email).charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.userName}>{u.name || u.email}</Text>
                      <Text style={styles.userMeta}>{u.email}</Text>
                      {!!u.phone && <Text style={styles.userMeta}>📱 {u.phone}</Text>}
                    </View>
                    {u.telegram_chat_id && (
                      <View style={styles.tgChip}>
                        <Ionicons name="paper-plane" size={11} color="#fff" />
                      </View>
                    )}
                  </View>
                  <View style={styles.userActions}>
                    <TouchableOpacity
                      style={[styles.userBtn, { backgroundColor: '#16A34A' }]}
                      onPress={() => userAction(u.id, 'approve')}
                      testID={`approve-${u.id}`}
                    >
                      <Ionicons name="checkmark" size={16} color="#fff" />
                      <Text style={styles.userBtnText}>Aprovar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.userBtn, { backgroundColor: '#991B1B' }]}
                      onPress={() => userAction(u.id, 'reject')}
                      testID={`reject-${u.id}`}
                    >
                      <Ionicons name="close" size={16} color="#fff" />
                      <Text style={styles.userBtnText}>Rejeitar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ));
            })()
          )}
        </ScrollView>
      )}

      {tab === 'users' && (
        <ScrollView contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: 60 }}>
          <View style={styles.onlineBanner}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>
              <Text style={{ fontWeight: '900' }}>{online.online_count}</Text> online · <Text style={{ fontWeight: '900' }}>{users.length}</Text> total
            </Text>
            {online.users.slice(0, 3).map((u: any) => (
              <View key={u.id} style={styles.onlineChip}>
                <Text style={styles.onlineChipText}>{u.name}</Text>
              </View>
            ))}
            {online.users.length > 3 && (
              <Text style={styles.onlineMore}>+{online.users.length - 3}</Text>
            )}
          </View>
          <Text style={styles.intro}>
            Lista de todos os utilizadores. Pode promover formandos a admin, ou despromover admins (exceto o admin principal).
          </Text>
          {usersLoading ? (
            <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 40 }} />
          ) : users.length === 0 ? (
            <Text style={styles.emptyText}>Sem utilizadores.</Text>
          ) : (
            users.map(u => (
              <View key={u.id} style={styles.userCard}>
                <View style={styles.userInfo}>
                  <View style={[styles.userAvatar, u.role === 'admin' && { backgroundColor: theme.colors.primary }]}>
                    <Text style={styles.userAvatarText}>{(u.name || u.email).charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.userName}>{u.name || u.email}</Text>
                    <Text style={styles.userMeta}>{u.email}</Text>
                    {!!u.phone && <Text style={styles.userMeta}>📱 {u.phone}</Text>}
                    <View style={styles.chipRow}>
                      <View style={[styles.chip, { backgroundColor: u.role === 'admin' ? theme.colors.primary : theme.colors.secondary }]}>
                        <Text style={styles.chipText}>{u.role === 'admin' ? 'ADMIN' : 'FORMANDO'}</Text>
                      </View>
                      <View style={[styles.chip, {
                        backgroundColor: u.status === 'approved' ? '#16A34A' : u.status === 'pending' ? '#D97706' : '#991B1B',
                      }]}>
                        <Text style={styles.chipText}>{(u.status || 'approved').toUpperCase()}</Text>
                      </View>
                      {!!u.telegram_chat_id && (
                        <View style={[styles.chip, { backgroundColor: '#0088cc' }]}>
                          <Text style={styles.chipText}>TELEGRAM</Text>
                        </View>
                      )}
                      {(u.score_total || 0) > 0 && (
                        <View style={[styles.chip, { backgroundColor: theme.colors.accent }]}>
                          <Text style={styles.chipText}>{u.score_total} pts</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
                <View style={styles.userActions}>
                  {u.status === 'pending' && (
                    <>
                      <TouchableOpacity
                        style={[styles.userBtn, { backgroundColor: '#16A34A' }]}
                        onPress={() => userAction(u.id, 'approve')}
                      >
                        <Text style={styles.userBtnText}>Aprovar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.userBtn, { backgroundColor: '#991B1B' }]}
                        onPress={() => userAction(u.id, 'reject')}
                      >
                        <Text style={styles.userBtnText}>Rejeitar</Text>
                      </TouchableOpacity>
                    </>
                  )}
                  {u.status === 'rejected' && (
                    <TouchableOpacity
                      style={[styles.userBtn, { backgroundColor: '#16A34A' }]}
                      onPress={() => userAction(u.id, 'approve')}
                    >
                      <Text style={styles.userBtnText}>Reativar</Text>
                    </TouchableOpacity>
                  )}
                  {u.role === 'formando' && u.status === 'approved' && (
                    <TouchableOpacity
                      style={[styles.userBtn, { backgroundColor: theme.colors.primary }]}
                      onPress={() => userAction(u.id, 'promote')}
                    >
                      <Ionicons name="ribbon-outline" size={14} color="#fff" />
                      <Text style={styles.userBtnText}>Promover</Text>
                    </TouchableOpacity>
                  )}
                  {u.role === 'admin' && (
                    <TouchableOpacity
                      style={[styles.userBtn, { backgroundColor: theme.colors.textMuted }]}
                      onPress={() => userAction(u.id, 'demote')}
                    >
                      <Ionicons name="arrow-down-outline" size={14} color="#fff" />
                      <Text style={styles.userBtnText}>Despromover</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      <PromptModal
        visible={createOpen}
        title="Novo Gavetão"
        placeholder="Nome da categoria"
        subtitleField
        onCancel={() => setCreateOpen(false)}
        onSubmit={createGavetao}
      />
      <PromptModal
        visible={!!createGavetaoId}
        title="Nova Gavetinha"
        placeholder="Nome do item"
        onCancel={() => setCreateGavetaoId(null)}
        onSubmit={createGavetinha}
      />

      <PromptModal
        visible={!!renameGavetinha}
        title="Renomear gavetinha"
        placeholder="Novo título"
        initialValue={renameGavetinha?.title || ''}
        submitLabel="Guardar"
        onCancel={() => setRenameGavetinha(null)}
        onSubmit={submitRenameGavetinha}
      />

      {/* Edit gavetao modal */}
      <Modal transparent visible={!!editTarget} animationType="fade" onRequestClose={() => setEditTarget(null)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <ScrollView style={styles.modalCard} contentContainerStyle={{ padding: 20 }}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Editar Gavetão</Text>
              <TouchableOpacity onPress={() => setEditTarget(null)} testID="edit-close">
                <Ionicons name="close" size={22} color={theme.colors.secondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Título</Text>
            <TextInput
              style={styles.modalInput}
              value={editTitle}
              onChangeText={setEditTitle}
              spellCheck
              autoCorrect
              testID="edit-title-input"
            />

            <Text style={[styles.modalLabel, { marginTop: 12 }]}>Subtítulo</Text>
            <TextInput
              style={styles.modalInput}
              value={editSubtitle}
              onChangeText={setEditSubtitle}
              spellCheck
              autoCorrect
              testID="edit-subtitle-input"
            />

            <Text style={[styles.modalLabel, { marginTop: 12 }]}>Imagem de capa</Text>
            {!!editImage && (
              <Image source={{ uri: editImage }} style={styles.editPreview} />
            )}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={styles.uploadSmall} onPress={pickEditImage} testID="edit-pick-image">
                <Ionicons name="image-outline" size={16} color="#fff" />
                <Text style={styles.uploadSmallText}>Carregar imagem</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.sizeHint}>
              📐 Recomendado: 800 × 500 px (16:10, paisagem) · até 1 MB
            </Text>
            <TextInput
              style={[styles.modalInput, { marginTop: 8 }]}
              value={editImage}
              onChangeText={setEditImage}
              placeholder="Ou cole um URL de imagem"
              placeholderTextColor={theme.colors.textLight}
              testID="edit-image-url"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtnOutline} onPress={() => setEditTarget(null)}>
                <Text style={styles.modalBtnOutlineText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtnPrimary, savingEdit && { opacity: 0.6 }]}
                onPress={saveEdit}
                disabled={savingEdit}
                testID="edit-save"
              >
                {savingEdit ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalBtnPrimaryText}>Guardar</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  topbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  iconBtn: {
    width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
    borderRadius: 4, backgroundColor: theme.colors.surfaceAlt,
  },
  topbarTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.secondary },
  intro: { fontSize: 13, color: theme.colors.textMuted, marginBottom: 16 },
  card: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 8, marginBottom: 12, overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', padding: 14, gap: 8,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.secondary },
  cardSub: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  cardActions: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: theme.colors.surfaceAlt, borderRadius: 4,
  },
  actionText: { fontSize: 12, fontWeight: '700', color: theme.colors.secondary },
  children: { padding: 14, gap: 8 },
  emptyText: { fontSize: 12, color: theme.colors.textLight, fontStyle: 'italic' },
  childRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  childTitle: { fontSize: 14, fontWeight: '600', color: theme.colors.textMain },
  childMeta: { fontSize: 11, color: theme.colors.textLight, marginTop: 2 },
  childDel: {
    padding: 6, borderRadius: 4, backgroundColor: '#FEF2F2',
  },
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)',
    alignItems: 'center', justifyContent: 'center', padding: 20,
  },
  modalCard: {
    width: '100%', maxWidth: 500, maxHeight: '90%',
    backgroundColor: '#fff', borderRadius: 10,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.secondary },
  modalLabel: { fontSize: 13, fontWeight: '700', color: theme.colors.secondary, marginBottom: 6 },
  modalInput: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: 6,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: theme.colors.textMain,
  },
  editPreview: {
    width: '100%', aspectRatio: 16 / 9, borderRadius: 6,
    backgroundColor: theme.colors.surfaceAlt, marginBottom: 8,
  },
  uploadSmall: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: theme.colors.secondary, paddingVertical: 10, paddingHorizontal: 14,
    borderRadius: 4, alignSelf: 'flex-start',
  },
  uploadSmallText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  modalBtnOutline: {
    flex: 1, paddingVertical: 12, alignItems: 'center',
    borderWidth: 1, borderColor: theme.colors.secondary, borderRadius: 4,
  },
  modalBtnOutlineText: { color: theme.colors.secondary, fontWeight: '700' },
  modalBtnPrimary: {
    flex: 1, paddingVertical: 12, alignItems: 'center',
    backgroundColor: theme.colors.primary, borderRadius: 4,
  },
  modalBtnPrimaryText: { color: '#fff', fontWeight: '700' },
  sizeHint: {
    marginTop: 6, fontSize: 11, color: theme.colors.textMuted,
    fontStyle: 'italic', letterSpacing: 0.3,
  },
  tabs: {
    flexDirection: 'row', backgroundColor: theme.colors.surface,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md, paddingVertical: 8, gap: 8,
  },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 4,
    backgroundColor: theme.colors.surfaceAlt,
  },
  tabActive: { backgroundColor: theme.colors.secondary },
  tabText: { fontSize: 12, fontWeight: '700', color: theme.colors.secondary },
  tabTextActive: { color: '#fff' },
  userCard: {
    backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 8, padding: 14, marginBottom: 10,
  },
  userInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  userAvatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.secondary,
    alignItems: 'center', justifyContent: 'center',
  },
  userAvatarText: { color: '#fff', fontWeight: '900', fontSize: 18 },
  userName: { fontSize: 15, fontWeight: '800', color: theme.colors.secondary },
  userMeta: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  chipRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 6 },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 3 },
  chipText: { color: '#fff', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  tgChip: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: '#0088cc',
    alignItems: 'center', justifyContent: 'center',
  },
  userActions: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  userBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 4,
  },
  userBtnText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  onlineBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap',
    backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#86EFAC',
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 6, marginBottom: 12,
  },
  onlineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#16A34A' },
  onlineText: { fontSize: 12, color: '#065F46', flex: 1 },
  onlineChip: { backgroundColor: '#16A34A', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  onlineChipText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  onlineMore: { fontSize: 11, color: '#065F46', fontWeight: '700' },
});
