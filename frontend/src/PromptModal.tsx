import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from './theme';

type Props = {
  visible: boolean;
  title: string;
  placeholder?: string;
  initialValue?: string;
  subtitleField?: boolean;
  onCancel: () => void;
  onSubmit: (title: string, subtitle?: string) => void;
  submitLabel?: string;
};

export default function PromptModal({
  visible,
  title,
  placeholder,
  initialValue = '',
  subtitleField = false,
  onCancel,
  onSubmit,
  submitLabel = 'Criar',
}: Props) {
  const [val, setVal] = useState(initialValue);
  const [sub, setSub] = useState('');

  useEffect(() => {
    if (visible) {
      setVal(initialValue);
      setSub('');
    }
  }, [visible, initialValue]);

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <View style={styles.card} testID="prompt-modal">
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onCancel} testID="prompt-close">
              <Ionicons name="close" size={22} color={theme.colors.secondary} />
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.input}
            placeholder={placeholder || 'Digite aqui'}
            placeholderTextColor={theme.colors.textLight}
            value={val}
            onChangeText={setVal}
            autoFocus
            testID="prompt-input"
          />
          {subtitleField && (
            <TextInput
              style={[styles.input, { marginTop: 10 }]}
              placeholder="Subtítulo (opcional)"
              placeholderTextColor={theme.colors.textLight}
              value={sub}
              onChangeText={setSub}
              testID="prompt-subtitle-input"
            />
          )}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.btnOutline} onPress={onCancel}>
              <Text style={styles.btnOutlineText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnPrimary, !val.trim() && { opacity: 0.5 }]}
              onPress={() => val.trim() && onSubmit(val.trim(), sub.trim() || undefined)}
              disabled={!val.trim()}
              testID="prompt-submit"
            >
              <Text style={styles.btnPrimaryText}>{submitLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  title: { fontSize: 18, fontWeight: '800', color: theme.colors.secondary },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: theme.colors.textMain,
  },
  actions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  btnOutline: {
    flex: 1, paddingVertical: 12, alignItems: 'center',
    borderWidth: 1, borderColor: theme.colors.secondary, borderRadius: 4,
  },
  btnOutlineText: { color: theme.colors.secondary, fontWeight: '700' },
  btnPrimary: {
    flex: 1, paddingVertical: 12, alignItems: 'center',
    backgroundColor: theme.colors.primary, borderRadius: 4,
  },
  btnPrimaryText: { color: '#fff', fontWeight: '700' },
});
