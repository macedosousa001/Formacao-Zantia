import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ImageBackground,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
  Modal,
  TextInput,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { theme, API_URL } from '../src/theme';
import PromptModal from '../src/PromptModal';
import LanguageSelector from '../src/LanguageSelector';
import { useI18n } from '../src/i18n';

type Gavetao = {
  id: string;
  title: string;
  subtitle: string;
  image_url: string;
  order: number;
  gavetinhas: { id: string }[];
};

export default function Home() {
  const router = useRouter();
  const { t } = useI18n();
  const [gavetoes, setGavetoes] = useState<Gavetao[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [settings, setSettings] = useState({
    hero_image: '',
    hero_title: 'Energia &\nClimatização',
    hero_subtitle: 'Fotovoltaico · Bombas de Calor · Caldeiras · Ar Condicionado · Acessórios',
  });
  const [editHero, setEditHero] = useState(false);
  const [draftImage, setDraftImage] = useState('');
  const [draftTitle, setDraftTitle] = useState('');
  const [draftSubtitle, setDraftSubtitle] = useState('');
  const [savingHero, setSavingHero] = useState(false);
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const columns = isWide ? (width >= 1200 ? 3 : 2) : 1;

  const load = useCallback(async () => {
    try {
      const [resG, resS] = await Promise.all([
        fetch(`${API_URL}/gavetoes`),
        fetch(`${API_URL}/settings`),
      ]);
      const data = await resG.json();
      const s = await resS.json();
      setGavetoes(data);
      setSettings(s);
    } catch (e) {
      console.log('load error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const createGavetao = async (title: string, subtitle?: string) => {
    setShowCreate(false);
    try {
      await fetch(`${API_URL}/gavetoes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, subtitle: subtitle || '' }),
      });
      load();
    } catch (e) {
      console.log(e);
    }
  };

  const openHeroEdit = () => {
    setDraftImage(settings.hero_image);
    setDraftTitle(settings.hero_title);
    setDraftSubtitle(settings.hero_subtitle);
    setEditHero(true);
  };

  const pickHeroImage = async () => {
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
      setDraftImage(a.base64 ? `data:${mime};base64,${a.base64}` : a.uri);
    }
  };

  const saveHero = async () => {
    setSavingHero(true);
    try {
      const res = await fetch(`${API_URL}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hero_image: draftImage,
          hero_title: draftTitle,
          hero_subtitle: draftSubtitle,
        }),
      });
      const updated = await res.json();
      setSettings(updated);
      setEditHero(false);
    } catch {
      Alert.alert('Erro', 'Não foi possível guardar.');
    } finally {
      setSavingHero(false);
    }
  };

  const cardWidth = columns === 1 ? '100%' : `${100 / columns - 2}%`;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header} testID="app-header">
        <View style={styles.logoRow}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>Z</Text>
          </View>
          <View>
            <Text style={styles.brand}>{t('appBrand')}</Text>
            <Text style={styles.brandSub}>{t('appBrandSub')}</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <LanguageSelector />
          <TouchableOpacity
            style={styles.adminBtn}
            onPress={() => router.push('/admin')}
            testID="admin-link"
          >
            <Ionicons name="settings-outline" size={16} color={theme.colors.secondary} />
            <Text style={styles.adminBtnText}>{t('administration')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
      >
        {/* Hero */}
        <ImageBackground
          source={{ uri: settings.hero_image || 'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=1600&q=80' }}
          style={[styles.hero, { minHeight: isWide ? 420 : 340 }]}
          testID="hero-section"
        >
          <View style={styles.heroOverlay} />
          <TouchableOpacity
            style={styles.heroEditBtn}
            onPress={openHeroEdit}
            testID="hero-edit-btn"
          >
            <Ionicons name="create-outline" size={16} color="#fff" />
            <Text style={styles.heroEditText}>{t('heroEditBtn')}</Text>
          </TouchableOpacity>
          <View style={[styles.heroContent, isWide && { paddingHorizontal: 64 }]}>
            <View style={styles.heroTag}>
              <View style={styles.heroDot} />
              <Text style={styles.heroTagText}>{t('heroEyebrow')}</Text>
            </View>
            <Text style={[styles.heroTitle, isWide && { fontSize: 48, maxWidth: 700 }]}>
              {settings.hero_title}
            </Text>
            <Text style={[styles.heroSubtitle, isWide && { maxWidth: 600 }]}>
              {settings.hero_subtitle}
            </Text>
            <TouchableOpacity
              style={styles.heroCta}
              onPress={() => router.push(`/gavetao/${gavetoes[0]?.id || 'g1'}`)}
              testID="hero-cta-explore"
            >
              <Text style={styles.heroCtaText}>{t('heroCta')}</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </ImageBackground>

        {/* Sections header */}
        <View style={[styles.sectionHeader, isWide && { paddingHorizontal: 64 }]}>
          <View style={styles.sectionHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionEyebrow}>{t('catalogEyebrow')}</Text>
              <Text style={styles.sectionTitle}>{gavetoes.length} {t('areasOfTraining')}</Text>
            </View>
            <TouchableOpacity
              style={styles.addInlineBtn}
              onPress={() => setShowCreate(true)}
              testID="add-gavetao-btn"
            >
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.addInlineText}>{t('newGavetao')}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.sectionDesc}>
            {t('catalogDesc')}
          </Text>
        </View>

        {/* Grid */}
        {loading ? (
          <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <View style={[styles.grid, isWide && { paddingHorizontal: 56 }]} testID="gavetoes-grid">
            {gavetoes.map((g, idx) => (
              <TouchableOpacity
                key={g.id}
                style={[styles.card, { width: cardWidth as any }]}
                onPress={() => router.push(`/gavetao/${g.id}`)}
                activeOpacity={0.85}
                testID={`gavetao-card-${g.id}`}
              >
                <View style={styles.cardImageWrap}>
                  <Image source={{ uri: g.image_url }} style={styles.cardImage} />
                  <View style={styles.cardNumberBadge}>
                    <Text style={styles.cardNumberText}>0{idx + 1}</Text>
                  </View>
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>{g.title}</Text>
                  <Text style={styles.cardSubtitle}>{g.subtitle}</Text>
                  <View style={styles.cardFooter}>
                    <Text style={styles.cardCount}>
                      {g.gavetinhas?.length || 0} {g.gavetinhas?.length === 1 ? t('item') : t('items')}
                    </Text>
                    <View style={styles.cardArrow}>
                      <Ionicons name="arrow-forward" size={16} color="#fff" />
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>{t('footer')}</Text>
        </View>
      </ScrollView>

      <PromptModal
        visible={showCreate}
        title={t('newGavetaoTitle')}
        placeholder={t('newGavetaoPlaceholder')}
        subtitleField
        onCancel={() => setShowCreate(false)}
        onSubmit={createGavetao}
        submitLabel={t('create')}
      />

      {/* Hero edit modal */}
      <Modal transparent visible={editHero} animationType="fade" onRequestClose={() => setEditHero(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <ScrollView style={styles.modalCard} contentContainerStyle={{ padding: 20 }}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Editar capa de entrada</Text>
              <TouchableOpacity onPress={() => setEditHero(false)} testID="hero-edit-close">
                <Ionicons name="close" size={22} color={theme.colors.secondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Imagem</Text>
            {!!draftImage && <Image source={{ uri: draftImage }} style={styles.heroPreview} />}
            <TouchableOpacity style={styles.uploadSmall} onPress={pickHeroImage} testID="hero-pick-image">
              <Ionicons name="image-outline" size={16} color="#fff" />
              <Text style={styles.uploadSmallText}>Carregar do dispositivo</Text>
            </TouchableOpacity>
            <Text style={styles.sizeHint}>
              📐 Recomendado: 1600 × 900 px (16:9, paisagem) · até 2 MB
            </Text>
            <TextInput
              style={[styles.modalInput, { marginTop: 8 }]}
              value={draftImage}
              onChangeText={setDraftImage}
              placeholder="Ou cole um URL de imagem"
              placeholderTextColor={theme.colors.textLight}
              testID="hero-image-url"
            />

            <Text style={[styles.modalLabel, { marginTop: 16 }]}>Título</Text>
            <TextInput
              style={[styles.modalInput, { minHeight: 60 }]}
              value={draftTitle}
              onChangeText={setDraftTitle}
              multiline
              spellCheck
              autoCorrect
              testID="hero-title-input"
            />

            <Text style={[styles.modalLabel, { marginTop: 12 }]}>Subtítulo</Text>
            <TextInput
              style={[styles.modalInput, { minHeight: 60 }]}
              value={draftSubtitle}
              onChangeText={setDraftSubtitle}
              multiline
              spellCheck
              autoCorrect
              testID="hero-subtitle-input"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalBtnOutline}
                onPress={() => setEditHero(false)}
                disabled={savingHero}
              >
                <Text style={styles.modalBtnOutlineText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtnPrimary, savingHero && { opacity: 0.6 }]}
                onPress={saveHero}
                disabled={savingHero}
                testID="hero-save"
              >
                {savingHero ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalBtnPrimaryText}>Guardar</Text>
                )}
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
  header: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  adminBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: 4,
  },
  adminBtnText: { fontSize: 12, fontWeight: '700', color: theme.colors.secondary, letterSpacing: 0.5 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  addInlineBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 4,
  },
  addInlineText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoBadge: {
    width: 40,
    height: 40,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
  },
  logoText: { color: '#fff', fontWeight: '900', fontSize: 22 },
  brand: { fontSize: 16, fontWeight: '800', color: theme.colors.secondary, letterSpacing: 2 },
  brandSub: { fontSize: 10, color: theme.colors.textMuted, letterSpacing: 3, marginTop: -2 },

  hero: { width: '100%', justifyContent: 'center' },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: theme.colors.overlay },
  heroContent: { padding: theme.spacing.lg, gap: 16 },
  heroTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: 4,
  },
  heroDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.primary },
  heroTagText: { color: '#fff', fontSize: 11, letterSpacing: 2, fontWeight: '700' },
  heroTitle: { color: '#fff', fontSize: 36, fontWeight: '900', lineHeight: 42 },
  heroSubtitle: { color: 'rgba(255,255,255,0.88)', fontSize: 14, lineHeight: 22 },
  heroCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 22,
    alignSelf: 'flex-start',
    borderRadius: 4,
    marginTop: 8,
  },
  heroCtaText: { color: '#fff', fontWeight: '700', fontSize: 14, letterSpacing: 0.5 },

  sectionHeader: { paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.xl, paddingBottom: theme.spacing.md },
  sectionEyebrow: { fontSize: 11, color: theme.colors.primary, fontWeight: '800', letterSpacing: 2 },
  sectionTitle: { fontSize: 28, fontWeight: '800', color: theme.colors.secondary, marginTop: 6 },
  sectionDesc: { fontSize: 14, color: theme.colors.textMuted, marginTop: 8, lineHeight: 20, maxWidth: 600 },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: theme.spacing.md,
    gap: 16,
    paddingTop: theme.spacing.md,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardImageWrap: { position: 'relative', aspectRatio: 16 / 10, backgroundColor: theme.colors.surfaceAlt },
  cardImage: { width: '100%', height: '100%' },
  cardNumberBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: theme.colors.secondary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
  },
  cardNumberText: { color: '#fff', fontWeight: '800', fontSize: 12, letterSpacing: 1 },
  cardBody: { padding: theme.spacing.md, gap: 6 },
  cardTitle: { fontSize: 20, fontWeight: '800', color: theme.colors.secondary },
  cardSubtitle: { fontSize: 13, color: theme.colors.textMuted },
  cardFooter: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardCount: { fontSize: 12, color: theme.colors.textMain, fontWeight: '700', letterSpacing: 0.5 },
  cardArrow: {
    width: 32,
    height: 32,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
  },

  footer: { paddingVertical: theme.spacing.xl, alignItems: 'center' },
  footerText: { fontSize: 12, color: theme.colors.textLight, letterSpacing: 1 },
  heroEditBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: 4,
    zIndex: 5,
  },
  heroEditText: { color: '#fff', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)',
    alignItems: 'center', justifyContent: 'center', padding: 20,
  },
  modalCard: {
    width: '100%', maxWidth: 520, maxHeight: '90%',
    backgroundColor: '#fff', borderRadius: 10,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.secondary },
  modalLabel: { fontSize: 13, fontWeight: '700', color: theme.colors.secondary, marginBottom: 6 },
  modalInput: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: 6,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: theme.colors.textMain,
  },
  heroPreview: {
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
});
