import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
  ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../src/theme';
import { useAuth } from '../src/auth';
import { useI18n } from '../src/i18n';

export default function LoginScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError('');
    if (!email.trim() || !password) {
      setError('Preencha email e palavra-passe');
      return;
    }
    setLoading(true);
    const res =
      mode === 'login'
        ? await login(email.trim(), password)
        : await register(email.trim(), password, name.trim());
    setLoading(false);
    if (!res.ok) {
      setError(res.error || 'Erro');
      return;
    }
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ImageBackground
        source={{ uri: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=1600&q=60' }}
        style={styles.bg}
      >
        <View style={styles.bgOverlay} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={styles.scroll}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => router.replace('/')}
              testID="login-back"
            >
              <Ionicons name="arrow-back" size={20} color="#fff" />
              <Text style={styles.backText}>Voltar</Text>
            </TouchableOpacity>

            <View style={styles.card}>
              <View style={styles.brandRow}>
                <View style={styles.logoBadge}>
                  <Text style={styles.logoText}>Z</Text>
                </View>
                <View>
                  <Text style={styles.brand}>ZANTIA</Text>
                  <Text style={styles.brandSub}>{t('appBrandSub')}</Text>
                </View>
              </View>

              <Text style={styles.title}>
                {mode === 'login' ? 'Entrar na plataforma' : 'Criar conta de formando'}
              </Text>
              <Text style={styles.subtitle}>
                {mode === 'login'
                  ? 'Aceda à sua área pessoal'
                  : 'Registe-se para fazer testes e acompanhar a sua evolução'}
              </Text>

              {mode === 'register' && (
                <>
                  <Text style={styles.label}>Nome</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="O seu nome"
                    placeholderTextColor={theme.colors.textLight}
                    value={name}
                    onChangeText={setName}
                    spellCheck
                    autoCorrect
                    testID="login-name"
                  />
                </>
              )}

              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="email@exemplo.com"
                placeholderTextColor={theme.colors.textLight}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                testID="login-email"
              />

              <Text style={styles.label}>Palavra-passe</Text>
              <TextInput
                style={styles.input}
                placeholder="Mínimo 6 caracteres"
                placeholderTextColor={theme.colors.textLight}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                testID="login-password"
              />

              {!!error && (
                <View style={styles.errorBox} testID="login-error">
                  <Ionicons name="alert-circle" size={16} color="#991B1B" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.submitBtn, loading && { opacity: 0.6 }]}
                onPress={submit}
                disabled={loading}
                testID="login-submit"
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitText}>
                    {mode === 'login' ? 'Entrar' : 'Criar conta'}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setMode(mode === 'login' ? 'register' : 'login');
                  setError('');
                }}
                style={styles.toggleBtn}
                testID="login-toggle"
              >
                <Text style={styles.toggleText}>
                  {mode === 'login'
                    ? 'Não tem conta? Registar como formando'
                    : 'Já tem conta? Entrar'}
                </Text>
              </TouchableOpacity>

              {mode === 'login' && (
                <Text style={styles.note}>
                  Os administradores são criados pelo sistema. Formandos podem registar-se livremente.
                </Text>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </ImageBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.secondary },
  bg: { flex: 1 },
  bgOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15, 23, 42, 0.78)' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', borderRadius: 4, marginBottom: 18,
  },
  backText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 24,
    width: '100%', maxWidth: 440, alignSelf: 'center',
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  logoBadge: {
    width: 40, height: 40, backgroundColor: theme.colors.primary,
    alignItems: 'center', justifyContent: 'center', borderRadius: 4,
  },
  logoText: { color: '#fff', fontWeight: '900', fontSize: 22 },
  brand: { fontSize: 16, fontWeight: '800', color: theme.colors.secondary, letterSpacing: 2 },
  brandSub: { fontSize: 10, color: theme.colors.textMuted, letterSpacing: 3, marginTop: -2 },
  title: { fontSize: 22, fontWeight: '800', color: theme.colors.secondary, marginTop: 6 },
  subtitle: { fontSize: 13, color: theme.colors.textMuted, marginTop: 4, marginBottom: 18 },
  label: { fontSize: 12, fontWeight: '700', color: theme.colors.secondary, marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: 6,
    paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, color: theme.colors.textMain,
  },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEE2E2', borderRadius: 6, padding: 10, marginTop: 14,
  },
  errorText: { color: '#991B1B', fontSize: 13, flex: 1 },
  submitBtn: {
    backgroundColor: theme.colors.primary, paddingVertical: 14, borderRadius: 4,
    alignItems: 'center', marginTop: 18,
  },
  submitText: { color: '#fff', fontWeight: '800', fontSize: 14, letterSpacing: 0.5 },
  toggleBtn: { paddingVertical: 12, alignItems: 'center' },
  toggleText: { color: theme.colors.secondary, fontSize: 13, fontWeight: '600' },
  note: {
    fontSize: 11, color: theme.colors.textLight, textAlign: 'center',
    fontStyle: 'italic', marginTop: 4,
  },
});
