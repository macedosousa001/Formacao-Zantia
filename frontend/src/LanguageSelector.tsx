import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from './theme';
import { useI18n, LANG_LABELS, Lang } from './i18n';

export default function LanguageSelector() {
  const { lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <>
      <TouchableOpacity
        style={styles.btn}
        onPress={() => setOpen(true)}
        testID="lang-selector"
      >
        <Text style={styles.flag}>{LANG_LABELS[lang].flag}</Text>
        <Text style={styles.code}>{lang.toUpperCase()}</Text>
        <Ionicons name="chevron-down" size={14} color={theme.colors.secondary} />
      </TouchableOpacity>

      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.menu}>
            {(Object.keys(LANG_LABELS) as Lang[]).map((l) => (
              <TouchableOpacity
                key={l}
                style={[styles.item, lang === l && styles.itemActive]}
                onPress={() => {
                  setLang(l);
                  setOpen(false);
                }}
                testID={`lang-${l}`}
              >
                <Text style={styles.itemFlag}>{LANG_LABELS[l].flag}</Text>
                <Text style={[styles.itemLabel, lang === l && styles.itemLabelActive]}>
                  {LANG_LABELS[l].label}
                </Text>
                {lang === l && (
                  <Ionicons name="checkmark" size={16} color={theme.colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 4,
  },
  flag: { fontSize: 16 },
  code: { fontSize: 12, fontWeight: '700', color: theme.colors.secondary, letterSpacing: 0.5 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    alignItems: 'flex-end',
    paddingTop: 70,
    paddingRight: 16,
  },
  menu: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 6,
    minWidth: 180,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 4,
  },
  itemActive: { backgroundColor: theme.colors.surfaceAlt },
  itemFlag: { fontSize: 18 },
  itemLabel: { flex: 1, fontSize: 14, color: theme.colors.textMain, fontWeight: '500' },
  itemLabelActive: { color: theme.colors.primary, fontWeight: '700' },
});
