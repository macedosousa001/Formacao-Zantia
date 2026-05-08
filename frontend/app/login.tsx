import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
  ImageBackground, Modal, Pressable, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../src/theme';
import { useAuth } from '../src/auth';
import { useI18n } from '../src/i18n';
import { COUNTRIES, findCountry, Country } from '../src/countries';

export default function LoginScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { login, register, getRememberedCredentials } = useAuth();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [country, setCountry] = useState<Country>(findCountry('PT')!);
  const [phone, setPhone] = useState('');
  const [remember, setRemember] = useState(true);
  const [showCountries, setShowCountries] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // On mount, prefill remembered credentials.
  useEffect(() => {
    (async () => {
      try {
        const r = await getRememberedCredentials();
        if (r.remember) {
          setRemember(true);
          setEmail(r.email);
          setPassword(r.password);
        }
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async () => {
    setError('');
    if (!email.trim() || !password) {
      setError('Preencha email e palavra-passe');
      return;
    }
    if (mode === 'register') {
      if (!firstName.trim()) { setError('Indique o primeiro nome'); return; }
      if (!lastName.trim()) { setError('Indique o apelido'); return; }
      if (!country?.name) { setError('Selecione o país'); return; }
      if (!phone.trim() || phone.trim().length < 6) {
        setError('Indique um telemóvel válido (mínimo 6 dígitos)');
        return;
      }
    }
    setLoading(true);
    const res =
      mode === 'login'
        ? await login(email.trim(), password, remember)
        : await register({
            email: email.trim(),
            password,
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            phone: phone.trim(),
            country: country.name,
          });
    setLoading(false);
    if (!res.ok) {
      setError(res.error || 'Erro');
      return;
    }
    router.replace('/');
  };

  return (
    <ImageBackground
      source={{ uri: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=1600&q=80' }}
      style={{ flex: 1 }}
      blurRadius={6}
    >
      <View style={styles.overlay} />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={20} color="#fff" />
              <Text style={styles.backText}>Voltar</Text>
            </TouchableOpacity>

            <View style={styles.brandWrap}>
              <View style={styles.logoBadge}>
                <Text style={styles.logoText}>Z</Text>
              </View>
              <Text style={styles.brand}>ZANTIA</Text>
              <Text style={styles.brandSub}>FORMAÇÃO</Text>
            </View>

            <View style={styles.card}>
              <View style={styles.modeRow}>
                <TouchableOpacity
                  style={[styles.modeBtn, mode === 'login' && styles.modeBtnActive]}
                  onPress={() => { setMode('login'); setError(''); }}
                  testID="login-toggle-login"
                >
                  <Text style={[styles.modeText, mode === 'login' && styles.modeTextActive]}>Entrar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modeBtn, mode === 'register' && styles.modeBtnActive]}
                  onPress={() => { setMode('register'); setError(''); }}
                  testID="login-toggle"
                >
                  <Text style={[styles.modeText, mode === 'register' && styles.modeTextActive]}>Registar</Text>
                </TouchableOpacity>
              </View>

              {mode === 'register' && (
                <>
                  <View style={styles.row2}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Primeiro nome</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Ex: João"
                        placeholderTextColor={theme.colors.textLight}
                        value={firstName}
                        onChangeText={setFirstName}
                        spellCheck
                        autoCorrect
                        testID="login-first-name"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Apelido</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Ex: Silva"
                        placeholderTextColor={theme.colors.textLight}
                        value={lastName}
                        onChangeText={setLastName}
                        spellCheck
                        autoCorrect
                        testID="login-last-name"
                      />
                    </View>
                  </View>

                  <Text style={styles.label}>País de acesso</Text>
                  <TouchableOpacity
                    style={styles.input}
                    onPress={() => setShowCountries(true)}
                    testID="login-country-picker"
                  >
                    <Text style={{ color: theme.colors.textMain, fontSize: 14 }}>
                      {country.flag}  {country.name}
                    </Text>
                  </TouchableOpacity>

                  <Text style={styles.label}>Telemóvel</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ex: 912345678"
                    placeholderTextColor={theme.colors.textLight}
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    testID="login-phone"
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
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                testID="login-email"
              />

              <Text style={styles.label}>Palavra-passe</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  placeholder="••••••••"
                  placeholderTextColor={theme.colors.textLight}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  testID="login-password"
                />
                <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword((v) => !v)}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={theme.colors.textMuted} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.rememberRow}
                onPress={() => setRemember((v) => !v)}
                testID="login-remember"
              >
                <View style={[styles.checkbox, remember && styles.checkboxOn]}>
                  {remember && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rememberText}>Lembrar-me neste dispositivo</Text>
                  <Text style={styles.rememberHint}>
                    {remember
                      ? 'Email e palavra-passe ficam guardados no dispositivo'
                      : 'Terá de introduzir as credenciais novamente'}
                  </Text>
                </View>
              </TouchableOpacity>

              {!!error && (
                <View style={styles.errorBox}>
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
                  <>
                    <Text style={styles.submitText}>{mode === 'login' ? 'Entrar' : 'Criar conta'}</Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                  </>
                )}
              </TouchableOpacity>

              {mode === 'register' && (
                <Text style={styles.note}>
                  Após o registo, a sua conta fica <Text style={{ fontWeight: '800' }}>pendente de aprovação</Text> pelo administrador.
                </Text>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Country picker modal */}
        <Modal visible={showCountries} animationType="slide" transparent onRequestClose={() => setShowCountries(false)}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowCountries(false)}>
            <Pressable style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Selecione o país</Text>
                <TouchableOpacity onPress={() => setShowCountries(false)}>
                  <Ionicons name="close" size={24} color={theme.colors.secondary} />
                </TouchableOpacity>
              </View>
              <FlatList
                data={COUNTRIES}
                keyExtractor={(c) => c.code}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.countryRow, country.code === item.code && styles.countryRowActive]}
                    onPress={() => { setCountry(item); setShowCountries(false); }}
                  >
                    <Text style={{ fontSize: 22 }}>{item.flag}</Text>
                    <Text style={[styles.countryText, country.code === item.code && { fontWeight: '900' }]}>
                      {item.name}
                    </Text>
                    {country.code === item.code && (
                      <Ionicons name="checkmark" size={18} color={theme.colors.primary} />
                    )}
                  </TouchableOpacity>
                )}
              />
            </Pressable>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(26, 54, 93, 0.85)' },
  scroll: { flexGrow: 1, padding: 20, paddingBottom: 60 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', padding: 6 },
  backText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  brandWrap: { alignItems: 'center', marginVertical: 24 },
  logoBadge: {
    width: 60, height: 60, borderRadius: 12, backgroundColor: theme.colors.primary,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  logoText: { color: '#fff', fontSize: 32, fontWeight: '900' },
  brand: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: 4 },
  brandSub: { color: '#FCA5A5', fontSize: 11, fontWeight: '700', letterSpacing: 6 },
  card: {
    backgroundColor: theme.colors.surface, borderRadius: 12, padding: 20,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  modeRow: {
    flexDirection: 'row', backgroundColor: theme.colors.surfaceAlt, borderRadius: 6,
    padding: 4, marginBottom: 16, gap: 4,
  },
  modeBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 4 },
  modeBtnActive: { backgroundColor: theme.colors.secondary },
  modeText: { fontSize: 13, fontWeight: '800', color: theme.colors.textMuted, letterSpacing: 1 },
  modeTextActive: { color: '#fff' },
  row2: { flexDirection: 'row', gap: 10 },
  label: { fontSize: 12, fontWeight: '700', color: theme.colors.secondary, marginBottom: 6, marginTop: 12, letterSpacing: 0.5 },
  input: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: 6,
    paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, color: theme.colors.textMain,
    backgroundColor: '#fff',
  },
  passwordRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  eyeBtn: {
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: 6,
  },
  rememberRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 14, padding: 4 },
  checkbox: {
    width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: theme.colors.border,
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  checkboxOn: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  rememberText: { fontSize: 13, fontWeight: '700', color: theme.colors.textMain },
  rememberHint: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FEE2E2', padding: 10, borderRadius: 4, marginTop: 12,
    borderWidth: 1, borderColor: '#FCA5A5',
  },
  errorText: { color: '#991B1B', fontSize: 13, fontWeight: '700', flex: 1 },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: theme.colors.primary, paddingVertical: 14, borderRadius: 6, marginTop: 18,
  },
  submitText: { color: '#fff', fontWeight: '900', fontSize: 14, letterSpacing: 0.5 },
  note: { fontSize: 11, color: theme.colors.textMuted, fontStyle: 'italic', marginTop: 12, textAlign: 'center', lineHeight: 16 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: theme.colors.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16,
    maxHeight: '75%', paddingBottom: 30,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.secondary },
  countryRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 18, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  countryRowActive: { backgroundColor: theme.colors.surfaceAlt },
  countryText: { fontSize: 14, color: theme.colors.textMain, flex: 1 },
});
