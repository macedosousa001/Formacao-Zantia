import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme, API_URL } from '../../src/theme';
import PromptModal from '../../src/PromptModal';

type Gavetinha = {
  id: string;
  title: string;
  description: string;
  images: string[];
  videos: string[];
};

type Gavetao = {
  id: string;
  title: string;
  subtitle: string;
  image_url: string;
  gavetinhas: Gavetinha[];
};

const CATEGORY_IMAGE_FALLBACK: Record<string, string> = {
  fotovoltaico: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=600&q=80',
  bombas: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80',
  caldeiras: 'https://images.unsplash.com/photo-1585412727339-54e4bae3bbf9?w=600&q=80',
  ar: 'https://images.unsplash.com/photo-1617861648989-76a572012089?w=600&q=80',
  acessorios: 'https://images.unsplash.com/photo-1581092918484-8313ea1cd5b5?w=600&q=80',
};

function fallbackImage(title: string) {
  const t = title.toLowerCase();
  if (t.includes('solar') || t.includes('painel') || t.includes('inversor') || t.includes('bateria') || t.includes('ev')) return CATEGORY_IMAGE_FALLBACK.fotovoltaico;
  if (t.includes('bomba') || t.includes('aqs') || t.includes('geo')) return CATEGORY_IMAGE_FALLBACK.bombas;
  if (t.includes('caldeira') || t.includes('pellet')) return CATEGORY_IMAGE_FALLBACK.caldeiras;
  if (t.includes('split') || t.includes('ar') || t.includes('cassete') || t.includes('vrf') || t.includes('conduta') || t.includes('teto') || t.includes('consola') || t.includes('portátil')) return CATEGORY_IMAGE_FALLBACK.ar;
  return CATEGORY_IMAGE_FALLBACK.acessorios;
}

export default function GavetaoScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<Gavetao | null>(null);
  const [loading, setLoading] = useState(true);
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const columns = isWide ? (width >= 1200 ? 4 : 3) : 2;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/gavetoes/${id}`);
      const d = await res.json();
      setData(d);
    } catch (e) {
      console.log('err', e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const createGavetinha = async (title: string) => {
    setShowCreate(false);
    try {
      await fetch(`${API_URL}/gavetinhas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gavetao_id: id, title, description: '' }),
      });
      load();
    } catch (e) { console.log(e); }
  };

  const itemWidth = `${100 / columns - 2}%`;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topbar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} testID="back-button">
          <Ionicons name="arrow-back" size={22} color={theme.colors.secondary} />
        </TouchableOpacity>
        <Text style={styles.topbarTitle} numberOfLines={1}>
          {data?.title || 'Carregando...'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {loading || !data ? (
        <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
          <View style={[styles.headerBanner, isWide && { paddingHorizontal: 56 }]}>
            <Image source={{ uri: data.image_url }} style={StyleSheet.absoluteFillObject as any} />
            <View style={styles.headerOverlay} />
            <View style={styles.headerContent}>
              <Text style={styles.headerEyebrow}>CATEGORIA</Text>
              <Text style={styles.headerTitle}>{data.title}</Text>
              <Text style={styles.headerSub}>{data.subtitle}</Text>
              <View style={styles.headerCountPill}>
                <Text style={styles.headerCountText}>
                  {data.gavetinhas.length} {data.gavetinhas.length === 1 ? 'item' : 'itens'}
                </Text>
              </View>
            </View>
          </View>

          <View style={[styles.grid, isWide && { paddingHorizontal: 56 }]} testID="gavetinhas-grid">
            {data.gavetinhas.map((g, idx) => {
              const cover = g.images[0] || fallbackImage(g.title);
              return (
                <TouchableOpacity
                  key={g.id}
                  style={[styles.item, { width: itemWidth as any }]}
                  onPress={() => router.push(`/gavetinha/${g.id}`)}
                  activeOpacity={0.85}
                  testID={`gavetinha-card-${g.id}`}
                >
                  <View style={styles.itemImgWrap}>
                    <Image source={{ uri: cover }} style={styles.itemImg} />
                    <View style={styles.itemNumber}>
                      <Text style={styles.itemNumberText}>{String(idx + 1).padStart(2, '0')}</Text>
                    </View>
                  </View>
                  <View style={styles.itemBody}>
                    <Text style={styles.itemTitle} numberOfLines={2}>{g.title}</Text>
                    <View style={styles.itemFooter}>
                      {g.videos.length > 0 && (
                        <Ionicons name="videocam" size={14} color={theme.colors.primary} />
                      )}
                      {g.images.length > 0 && (
                        <Ionicons name="images" size={14} color={theme.colors.textMuted} />
                      )}
                      <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} style={{ marginLeft: 'auto' }} />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
            {/* Add card */}
            <TouchableOpacity
              style={[styles.item, styles.addCard, { width: itemWidth as any }]}
              onPress={() => setShowCreate(true)}
              testID="add-gavetinha-btn"
            >
              <Ionicons name="add-circle-outline" size={42} color={theme.colors.primary} />
              <Text style={styles.addCardText}>Nova gavetinha</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      <PromptModal
        visible={showCreate}
        title="Nova Gavetinha"
        placeholder="Nome do item"
        onCancel={() => setShowCreate(false)}
        onSubmit={createGavetinha}
      />
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
  backBtn: {
    width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
    borderRadius: 4, backgroundColor: theme.colors.surfaceAlt,
  },
  topbarTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.secondary, flex: 1, textAlign: 'center' },

  headerBanner: { minHeight: 220, justifyContent: 'center', padding: theme.spacing.lg, overflow: 'hidden' },
  headerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: theme.colors.overlay },
  headerContent: { gap: 8 },
  headerEyebrow: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 3, opacity: 0.85 },
  headerTitle: { color: '#fff', fontSize: 34, fontWeight: '900' },
  headerSub: { color: 'rgba(255,255,255,0.85)', fontSize: 14 },
  headerCountPill: {
    alignSelf: 'flex-start',
    marginTop: 10,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  headerCountText: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 1 },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: theme.spacing.md,
    gap: 12,
  },
  item: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  itemImgWrap: { position: 'relative', aspectRatio: 1, backgroundColor: theme.colors.surfaceAlt },
  itemImg: { width: '100%', height: '100%' },
  itemNumber: {
    position: 'absolute', top: 8, left: 8,
    backgroundColor: 'rgba(26, 54, 93, 0.92)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 3,
  },
  itemNumberText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  itemBody: { padding: 12, gap: 8, minHeight: 80 },
  itemTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.secondary, lineHeight: 18 },
  itemFooter: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.colors.border,
  },
  addCard: {
    alignItems: 'center', justifyContent: 'center',
    borderStyle: 'dashed', borderColor: theme.colors.primary, borderWidth: 2,
    minHeight: 180, padding: 16, gap: 8, backgroundColor: theme.colors.surfaceAlt,
  },
  addCardText: { fontWeight: '800', color: theme.colors.primary, fontSize: 13 },
});
