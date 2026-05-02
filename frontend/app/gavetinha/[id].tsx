import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  TextInput,
  Alert,
  Platform,
  KeyboardAvoidingView,
  useWindowDimensions,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { WebView } from 'react-native-webview';
import { theme, API_URL } from '../../src/theme';
import PromptModal from '../../src/PromptModal';

type Gavetinha = {
  id: string;
  gavetao_id: string;
  title: string;
  description: string;
  specs: string;
  images: string[];
  videos: string[];
  pdfs: { name: string; data: string }[];
};

function extractYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}
function extractVimeoId(url: string): string | null {
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return m ? m[1] : null;
}
function videoEmbedUrl(url: string): string | null {
  const yt = extractYouTubeId(url);
  if (yt) return `https://www.youtube.com/embed/${yt}`;
  const vm = extractVimeoId(url);
  if (vm) return `https://player.vimeo.com/video/${vm}`;
  return null;
}

export default function GavetinhaScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<Gavetinha | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [specs, setSpecs] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [videos, setVideos] = useState<string[]>([]);
  const [pdfs, setPdfs] = useState<{ name: string; data: string }[]>([]);
  const [videoInput, setVideoInput] = useState('');
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [children, setChildren] = useState<Gavetinha[]>([]);
  const [showCreateChild, setShowCreateChild] = useState(false);

  const { width } = useWindowDimensions();
  const isWide = width >= 900;

  const load = useCallback(async () => {
    try {
      const [res, cres] = await Promise.all([
        fetch(`${API_URL}/gavetinhas/${id}`),
        fetch(`${API_URL}/gavetinhas/${id}/children`),
      ]);
      const d = await res.json();
      const c = await cres.json();
      setData(d);
      setTitle(d.title);
      setDescription(d.description);
      setSpecs(d.specs || '');
      setImages(d.images);
      setVideos(d.videos);
      setPdfs(d.pdfs || []);
      setActiveImageIdx(0);
      setChildren(Array.isArray(c) ? c : []);
    } catch (e) {
      console.log('err', e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permissão necessária', 'Precisamos de acesso às imagens.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      base64: true,
      allowsMultipleSelection: false,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const mime = asset.mimeType || 'image/jpeg';
      const b64 = asset.base64 ? `data:${mime};base64,${asset.base64}` : asset.uri;
      setImages((prev) => [...prev, b64]);
    }
  };

  const removeImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
    if (activeImageIdx >= idx && activeImageIdx > 0) setActiveImageIdx(activeImageIdx - 1);
  };

  const addVideo = () => {
    const url = videoInput.trim();
    if (!url) return;
    if (!videoEmbedUrl(url)) {
      Alert.alert('URL inválido', 'Use um link do YouTube ou Vimeo.');
      return;
    }
    setVideos((prev) => [...prev, url]);
    setVideoInput('');
  };

  const removeVideo = (idx: number) => {
    setVideos((prev) => prev.filter((_, i) => i !== idx));
  };

  const pickPdf = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    try {
      let dataUri: string;
      if (Platform.OS === 'web') {
        // On web, uri is a blob: URL. Fetch and convert to base64.
        const resp = await fetch(asset.uri);
        const blob = await resp.blob();
        dataUri = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } else {
        const b64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'base64' });
        dataUri = `data:application/pdf;base64,${b64}`;
      }
      setPdfs((prev) => [...prev, { name: asset.name || 'documento.pdf', data: dataUri }]);
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível carregar o PDF.');
    }
  };

  const removePdf = (idx: number) => {
    setPdfs((prev) => prev.filter((_, i) => i !== idx));
  };

  const openPdf = async (pdf: { name: string; data: string }) => {
    if (Platform.OS === 'web') {
      // Open in new tab
      const win = window.open();
      if (win) {
        win.document.write(
          `<iframe src="${pdf.data}" style="border:0;width:100%;height:100vh" title="${pdf.name}"></iframe>`
        );
      }
    } else {
      Linking.openURL(pdf.data).catch(() => {
        Alert.alert('Não foi possível abrir', 'Este dispositivo não tem visualizador de PDF.');
      });
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/gavetinhas/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, specs, images, videos, pdfs }),
      });
      if (!res.ok) throw new Error('failed');
      const updated = await res.json();
      setData(updated);
      setEditing(false);
    } catch {
      Alert.alert('Erro', 'Não foi possível guardar.');
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    if (!data) return;
    setTitle(data.title);
    setDescription(data.description);
    setSpecs(data.specs || '');
    setImages(data.images);
    setVideos(data.videos);
    setPdfs(data.pdfs || []);
    setEditing(false);
  };

  const createChild = async (childTitle: string) => {
    setShowCreateChild(false);
    if (!data) return;
    try {
      await fetch(`${API_URL}/gavetinhas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gavetao_id: data.gavetao_id,
          parent_gavetinha_id: data.id,
          title: childTitle,
          description: '',
        }),
      });
      load();
    } catch (e) { console.log(e); }
  };

  if (loading || !data) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  const mainImage = images[activeImageIdx];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.topbar}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()} testID="back-button">
            <Ionicons name="arrow-back" size={22} color={theme.colors.secondary} />
          </TouchableOpacity>
          <Text style={styles.topbarTitle} numberOfLines={1}>{data.title}</Text>
          {editing ? (
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: theme.colors.surfaceAlt }]}
              onPress={cancel}
              testID="cancel-edit"
            >
              <Ionicons name="close" size={20} color={theme.colors.secondary} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: theme.colors.primary }]}
              onPress={() => setEditing(true)}
              testID="edit-button"
            >
              <Ionicons name="create-outline" size={20} color="#fff" />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>
          <View style={[styles.body, isWide && styles.bodyWide]}>
            {/* Media column */}
            <View style={[styles.mediaCol, isWide && { flex: 1 }]}>
              <View style={styles.mainImageWrap} testID="main-image-wrap">
                {mainImage ? (
                  <Image source={{ uri: mainImage }} style={styles.mainImage} />
                ) : (
                  <View style={styles.emptyImage}>
                    <Ionicons name="images-outline" size={48} color={theme.colors.textLight} />
                    <Text style={styles.emptyText}>Sem imagens ainda</Text>
                  </View>
                )}
              </View>

              {images.length > 1 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                  <View style={styles.thumbRow}>
                    {images.map((img, idx) => (
                      <TouchableOpacity
                        key={idx}
                        onPress={() => setActiveImageIdx(idx)}
                        style={[styles.thumb, activeImageIdx === idx && styles.thumbActive]}
                        testID={`thumb-${idx}`}
                      >
                        <Image source={{ uri: img }} style={styles.thumbImg} />
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              )}

              {editing && (
                <View style={{ marginTop: 12 }}>
                  <TouchableOpacity style={styles.uploadBtn} onPress={pickImage} testID="upload-image-btn">
                    <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
                    <Text style={styles.uploadBtnText}>Adicionar imagem</Text>
                  </TouchableOpacity>
                  {images.length > 0 && (
                    <View style={{ marginTop: 10 }}>
                      <Text style={styles.labelSmall}>Gerir imagens ({images.length})</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={styles.thumbRow}>
                          {images.map((img, idx) => (
                            <View key={idx} style={styles.thumb}>
                              <Image source={{ uri: img }} style={styles.thumbImg} />
                              <TouchableOpacity
                                style={styles.thumbRemove}
                                onPress={() => removeImage(idx)}
                                testID={`remove-image-${idx}`}
                              >
                                <Ionicons name="trash" size={12} color="#fff" />
                              </TouchableOpacity>
                            </View>
                          ))}
                        </View>
                      </ScrollView>
                    </View>
                  )}
                </View>
              )}

              {/* Videos */}
              {videos.length > 0 && (
                <View style={{ marginTop: 18 }}>
                  <Text style={styles.label}>Vídeos</Text>
                  {videos.map((v, idx) => {
                    const embed = videoEmbedUrl(v);
                    return (
                      <View key={idx} style={styles.videoWrap}>
                        {embed ? (
                          Platform.OS === 'web' ? (
                            <View style={styles.videoFrame}>
                              {/* @ts-ignore iframe only on web */}
                              <iframe
                                src={embed}
                                style={{ width: '100%', height: '100%', border: 0 }}
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                              />
                            </View>
                          ) : (
                            <View style={styles.videoFrame}>
                              <WebView source={{ uri: embed }} allowsFullscreenVideo style={{ flex: 1 }} />
                            </View>
                          )
                        ) : (
                          <TouchableOpacity onPress={() => Linking.openURL(v)} style={styles.videoLink}>
                            <Ionicons name="play-circle" size={22} color={theme.colors.primary} />
                            <Text style={styles.videoLinkText} numberOfLines={1}>{v}</Text>
                          </TouchableOpacity>
                        )}
                        {editing && (
                          <TouchableOpacity
                            style={styles.videoRemoveBtn}
                            onPress={() => removeVideo(idx)}
                            testID={`remove-video-${idx}`}
                          >
                            <Ionicons name="trash-outline" size={14} color={theme.colors.primary} />
                            <Text style={styles.videoRemoveText}>Remover</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}

              {editing && (
                <View style={styles.videoAddRow}>
                  <TextInput
                    style={styles.input}
                    placeholder="Cole URL YouTube/Vimeo"
                    placeholderTextColor={theme.colors.textLight}
                    value={videoInput}
                    onChangeText={setVideoInput}
                    testID="video-url-input"
                  />
                  <TouchableOpacity style={styles.addBtn} onPress={addVideo} testID="add-video-btn">
                    <Ionicons name="add" size={22} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}

              {/* PDFs */}
              {(pdfs.length > 0 || editing) && (
                <View style={{ marginTop: 18 }}>
                  <Text style={styles.label}>Documentos PDF</Text>
                  {pdfs.map((pdf, idx) => (
                    <View key={idx} style={styles.pdfRow}>
                      <TouchableOpacity
                        style={styles.pdfInfo}
                        onPress={() => openPdf(pdf)}
                        testID={`pdf-open-${idx}`}
                      >
                        <Ionicons name="document-text" size={22} color={theme.colors.primary} />
                        <Text style={styles.pdfName} numberOfLines={1}>{pdf.name}</Text>
                      </TouchableOpacity>
                      {editing && (
                        <TouchableOpacity
                          onPress={() => removePdf(idx)}
                          style={styles.pdfRemove}
                          testID={`pdf-remove-${idx}`}
                        >
                          <Ionicons name="trash-outline" size={16} color="#991B1B" />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                  {editing && (
                    <TouchableOpacity
                      style={[styles.uploadBtn, { marginTop: 10, backgroundColor: theme.colors.accent }]}
                      onPress={pickPdf}
                      testID="upload-pdf-btn"
                    >
                      <Ionicons name="document-attach-outline" size={18} color="#fff" />
                      <Text style={styles.uploadBtnText}>Adicionar PDF</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>

            {/* Info column */}
            <View style={[styles.infoCol, isWide && { flex: 1 }]}>
              <Text style={styles.eyebrow}>FICHA TÉCNICA</Text>

              {editing ? (
                <>
                  <Text style={styles.label}>Título</Text>
                  <TextInput
                    style={styles.input}
                    value={title}
                    onChangeText={setTitle}
                    testID="title-input"
                  />
                  <Text style={[styles.label, { marginTop: 14 }]}>Descrição</Text>
                  <TextInput
                    style={[styles.input, styles.textarea]}
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    textAlignVertical="top"
                    testID="description-input"
                  />
                  <Text style={[styles.label, { marginTop: 14 }]}>Especificações técnicas</Text>
                  <TextInput
                    style={[styles.input, styles.textarea]}
                    value={specs}
                    onChangeText={setSpecs}
                    placeholder="Potência, dimensões, certificações..."
                    placeholderTextColor={theme.colors.textLight}
                    multiline
                    textAlignVertical="top"
                    testID="specs-input"
                  />
                  <View style={styles.actionsRow}>
                    <TouchableOpacity style={styles.btnOutline} onPress={cancel} disabled={saving}>
                      <Text style={styles.btnOutlineText}>Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.btnPrimary}
                      onPress={save}
                      disabled={saving}
                      testID="save-button"
                    >
                      {saving ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="checkmark" size={18} color="#fff" />
                          <Text style={styles.btnPrimaryText}>Guardar alterações</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.title} testID="detail-title">{data.title}</Text>
                  <View style={styles.divider} />
                  <Text style={styles.description} testID="detail-description">
                    {data.description || 'Sem descrição. Use o botão editar para adicionar conteúdo.'}
                  </Text>
                  {!!data.specs && (
                    <>
                      <Text style={[styles.eyebrow, { marginTop: 18 }]}>ESPECIFICAÇÕES</Text>
                      <Text style={[styles.description, { marginTop: 8 }]} testID="detail-specs">
                        {data.specs}
                      </Text>
                    </>
                  )}
                  <View style={styles.metaRow}>
                    <View style={styles.metaChip}>
                      <Ionicons name="images-outline" size={14} color={theme.colors.secondary} />
                      <Text style={styles.metaChipText}>{images.length} imagens</Text>
                    </View>
                    <View style={styles.metaChip}>
                      <Ionicons name="videocam-outline" size={14} color={theme.colors.secondary} />
                      <Text style={styles.metaChipText}>{videos.length} vídeos</Text>
                    </View>
                    <View style={styles.metaChip}>
                      <Ionicons name="document-text-outline" size={14} color={theme.colors.secondary} />
                      <Text style={styles.metaChipText}>{pdfs.length} PDFs</Text>
                    </View>
                  </View>
                </>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  iconBtn: {
    width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
    borderRadius: 4, backgroundColor: theme.colors.surfaceAlt,
  },
  topbarTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.secondary, flex: 1, textAlign: 'center', paddingHorizontal: 8 },

  body: { padding: theme.spacing.md, gap: 20 },
  bodyWide: { flexDirection: 'row', gap: 32, padding: 48 },
  mediaCol: {},
  infoCol: {},

  mainImageWrap: {
    aspectRatio: 4 / 3, backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.md, overflow: 'hidden',
    borderWidth: 1, borderColor: theme.colors.border,
  },
  mainImage: { width: '100%', height: '100%' },
  emptyImage: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyText: { color: theme.colors.textLight, fontSize: 13 },

  thumbRow: { flexDirection: 'row', gap: 8 },
  thumb: {
    width: 68, height: 68, borderRadius: 6, overflow: 'hidden',
    borderWidth: 2, borderColor: 'transparent', position: 'relative',
  },
  thumbActive: { borderColor: theme.colors.primary },
  thumbImg: { width: '100%', height: '100%' },
  thumbRemove: {
    position: 'absolute', top: 2, right: 2,
    backgroundColor: theme.colors.primary,
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },

  uploadBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: theme.colors.secondary, paddingVertical: 12, borderRadius: 4,
  },
  uploadBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  videoWrap: { marginTop: 10 },
  videoFrame: {
    aspectRatio: 16 / 9, backgroundColor: '#000',
    borderRadius: theme.radius.md, overflow: 'hidden',
  },
  videoLink: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border,
    padding: 12, borderRadius: 8,
  },
  videoLinkText: { flex: 1, color: theme.colors.textMain, fontSize: 13 },
  videoRemoveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-end', marginTop: 6,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 4, backgroundColor: '#FEF2F2',
  },
  videoRemoveText: { color: theme.colors.primary, fontSize: 12, fontWeight: '600' },

  videoAddRow: { flexDirection: 'row', gap: 8, marginTop: 12, alignItems: 'center' },
  addBtn: {
    width: 44, height: 44, borderRadius: 4,
    backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center',
  },

  eyebrow: { fontSize: 11, color: theme.colors.primary, fontWeight: '800', letterSpacing: 3 },
  title: { fontSize: 30, fontWeight: '900', color: theme.colors.secondary, marginTop: 8 },
  divider: { height: 3, width: 40, backgroundColor: theme.colors.primary, marginVertical: 14 },
  description: { fontSize: 15, color: theme.colors.textMuted, lineHeight: 24 },
  metaRow: { flexDirection: 'row', gap: 8, marginTop: 20 },
  metaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: theme.colors.surface,
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: 4,
  },
  metaChipText: { fontSize: 12, color: theme.colors.secondary, fontWeight: '700' },

  label: { fontSize: 13, fontWeight: '700', color: theme.colors.secondary, marginBottom: 6 },
  labelSmall: { fontSize: 11, fontWeight: '700', color: theme.colors.textMuted, marginBottom: 6, letterSpacing: 1 },
  input: {
    flex: 1,
    borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface,
    borderRadius: 6, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: theme.colors.textMain,
  },
  textarea: { minHeight: 140, paddingTop: 12 },

  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  btnOutline: {
    flex: 1, paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: theme.colors.secondary, borderRadius: 4,
  },
  btnOutlineText: { color: theme.colors.secondary, fontWeight: '700' },
  btnPrimary: {
    flex: 2, flexDirection: 'row', gap: 8, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.colors.primary, borderRadius: 4,
  },
  btnPrimaryText: { color: '#fff', fontWeight: '700' },
  subHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  subTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.secondary, marginTop: 4 },
  smallAddBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: theme.colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 4,
  },
  smallAddText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  childGrid: { gap: 8 },
  childCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border,
    padding: 14, borderRadius: 6,
  },
  childBadge: {
    backgroundColor: theme.colors.secondary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 3,
  },
  childBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  childTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: theme.colors.secondary },
  pdfRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: theme.colors.surfaceAlt, borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 6, padding: 10, marginTop: 6,
  },
  pdfInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  pdfName: { flex: 1, fontSize: 13, fontWeight: '600', color: theme.colors.textMain },
  pdfRemove: { padding: 6, borderRadius: 4, backgroundColor: '#FEF2F2' },
});
