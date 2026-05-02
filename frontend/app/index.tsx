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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme, API_URL } from '../src/theme';
import PromptModal from '../src/PromptModal';

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
  const [gavetoes, setGavetoes] = useState<Gavetao[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const columns = isWide ? (width >= 1200 ? 3 : 2) : 1;

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/gavetoes`);
      const data = await res.json();
      setGavetoes(data);
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

  const cardWidth = columns === 1 ? '100%' : `${100 / columns - 2}%`;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header} testID="app-header">
        <View style={styles.logoRow}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>Z</Text>
          </View>
          <View>
            <Text style={styles.brand}>ZANTIA</Text>
            <Text style={styles.brandSub}>FORMAÇÃO</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.adminBtn}
          onPress={() => router.push('/admin')}
          testID="admin-link"
        >
          <Ionicons name="settings-outline" size={16} color={theme.colors.secondary} />
          <Text style={styles.adminBtnText}>Administração</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
      >
        {/* Hero */}
        <ImageBackground
          source={{ uri: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=1600&q=80' }}
          style={[styles.hero, { minHeight: isWide ? 420 : 340 }]}
          testID="hero-section"
        >
          <View style={styles.heroOverlay} />
          <View style={[styles.heroContent, isWide && { paddingHorizontal: 64 }]}>
            <View style={styles.heroTag}>
              <View style={styles.heroDot} />
              <Text style={styles.heroTagText}>PLATAFORMA DE FORMAÇÃO</Text>
            </View>
            <Text style={[styles.heroTitle, isWide && { fontSize: 48, maxWidth: 700 }]}>
              Energia &{'\n'}Climatização
            </Text>
            <Text style={[styles.heroSubtitle, isWide && { maxWidth: 600 }]}>
              Fotovoltaico · Bombas de Calor · Caldeiras · Ar Condicionado · Acessórios
            </Text>
            <TouchableOpacity
              style={styles.heroCta}
              onPress={() => router.push(`/gavetao/${gavetoes[0]?.id || 'g1'}`)}
              testID="hero-cta-explore"
            >
              <Text style={styles.heroCtaText}>Explorar Categorias</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </ImageBackground>

        {/* Sections header */}
        <View style={[styles.sectionHeader, isWide && { paddingHorizontal: 64 }]}>
          <View style={styles.sectionHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionEyebrow}>CATÁLOGO TÉCNICO</Text>
              <Text style={styles.sectionTitle}>{gavetoes.length} áreas de formação</Text>
            </View>
            <TouchableOpacity
              style={styles.addInlineBtn}
              onPress={() => setShowCreate(true)}
              testID="add-gavetao-btn"
            >
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.addInlineText}>Novo gavetão</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.sectionDesc}>
            Conteúdos organizados por categoria. Selecione um gavetão para aceder às fichas técnicas, imagens e vídeos.
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
                      {g.gavetinhas?.length || 0} {g.gavetinhas?.length === 1 ? 'item' : 'itens'}
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
          <Text style={styles.footerText}>© Zantia Formação · Plataforma interna</Text>
        </View>
      </ScrollView>

      <PromptModal
        visible={showCreate}
        title="Novo Gavetão"
        placeholder="Nome da categoria"
        subtitleField
        onCancel={() => setShowCreate(false)}
        onSubmit={createGavetao}
      />
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
});
