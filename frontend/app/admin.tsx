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

type Gavetao = { id: string; title: string; subtitle: string; image_url: string; gavetinhas: any[] };

export default function Admin() {
  const router = useRouter();
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

  useEffect(() => { load(); }, [load]);

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
        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: theme.colors.primary }]}
          onPress={() => setCreateOpen(true)}
          testID="admin-add-gavetao"
        >
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? (
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
              testID="edit-title-input"
            />

            <Text style={[styles.modalLabel, { marginTop: 12 }]}>Subtítulo</Text>
            <TextInput
              style={styles.modalInput}
              value={editSubtitle}
              onChangeText={setEditSubtitle}
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
});
