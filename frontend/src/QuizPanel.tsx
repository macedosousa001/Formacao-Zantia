import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme, API_URL } from './theme';
import { useAuth } from './auth';

export type QuizQuestion = {
  question: string;
  options: string[];
  correct_index: number;
};

type Props = {
  entityType: 'gavetoes' | 'gavetinhas';
  entityId: string;
  entityTitle?: string;
  initialQuiz: QuizQuestion[];
  onSaved?: (quiz: QuizQuestion[]) => void;
};

export default function QuizPanel({ entityType, entityId, entityTitle, initialQuiz, onSaved }: Props) {
  const { isAdmin, isAuthed, authFetch, refresh } = useAuth();
  const [quiz, setQuiz] = useState<QuizQuestion[]>(initialQuiz);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  // Take-mode state
  const [taking, setTaking] = useState(false);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [savedAttempt, setSavedAttempt] = useState(false);

  useEffect(() => {
    setQuiz(initialQuiz);
  }, [initialQuiz]);

  const startTest = () => {
    setAnswers({});
    setSubmitted(false);
    setTaking(true);
  };

  const submitTest = async () => {
    setSubmitted(true);
    // Record attempt if authenticated
    if (isAuthed) {
      try {
        const res = await authFetch('/auth/quiz-attempts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entity_type: entityType,
            entity_id: entityId,
            entity_title: entityTitle || '',
            score,
            total: quiz.length,
          }),
        });
        if (res.ok) {
          setSavedAttempt(true);
          await refresh(); // update score_total in user object
        }
      } catch {
        // silent
      }
    }
  };

  const resetTest = () => {
    setAnswers({});
    setSubmitted(false);
    setTaking(false);
  };

  const score = quiz.reduce((acc, q, i) => acc + (answers[i] === q.correct_index ? 1 : 0), 0);

  // Edit handlers
  const addQuestion = () => {
    setQuiz((prev) => [
      ...prev,
      { question: '', options: ['', '', ''], correct_index: 0 },
    ]);
  };

  const updateQuestion = (qIdx: number, patch: Partial<QuizQuestion>) => {
    setQuiz((prev) => prev.map((q, i) => (i === qIdx ? { ...q, ...patch } : q)));
  };

  const updateOption = (qIdx: number, oIdx: number, value: string) => {
    setQuiz((prev) =>
      prev.map((q, i) =>
        i === qIdx ? { ...q, options: q.options.map((o, j) => (j === oIdx ? value : o)) } : q
      )
    );
  };

  const removeQuestion = (qIdx: number) => {
    setQuiz((prev) => prev.filter((_, i) => i !== qIdx));
  };

  const save = async () => {
    // Validate
    for (const q of quiz) {
      if (!q.question.trim()) {
        Alert.alert('Validação', 'Todas as perguntas devem ter texto.');
        return;
      }
      if (q.options.some((o) => !o.trim())) {
        Alert.alert('Validação', 'Todas as opções devem ter texto.');
        return;
      }
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/${entityType}/${entityId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quiz }),
      });
      if (!res.ok) throw new Error();
      setEditing(false);
      onSaved?.(quiz);
    } catch {
      Alert.alert('Erro', 'Não foi possível guardar o teste.');
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    setQuiz(initialQuiz);
    setEditing(false);
  };

  // ---------------- Render ----------------
  return (
    <View style={styles.panel} testID="quiz-panel">
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>TESTE DE APRENDIZAGEM</Text>
          <Text style={styles.title}>
            {quiz.length} {quiz.length === 1 ? 'pergunta' : 'perguntas'}
          </Text>
        </View>
        {!editing && !taking && isAdmin && (
          <TouchableOpacity
            style={styles.editIcon}
            onPress={() => setEditing(true)}
            testID="quiz-edit-btn"
          >
            <Ionicons name="create-outline" size={18} color={theme.colors.secondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Edit mode */}
      {editing && (
        <View>
          {quiz.length === 0 && (
            <Text style={styles.emptyText}>Sem perguntas. Adicione a primeira.</Text>
          )}
          {quiz.map((q, qIdx) => (
            <View key={qIdx} style={styles.editCard}>
              <View style={styles.editCardHeader}>
                <Text style={styles.editCardLabel}>Pergunta {qIdx + 1}</Text>
                <TouchableOpacity
                  onPress={() => removeQuestion(qIdx)}
                  style={styles.removeBtn}
                  testID={`quiz-remove-q-${qIdx}`}
                >
                  <Ionicons name="trash-outline" size={14} color="#991B1B" />
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Texto da pergunta"
                placeholderTextColor={theme.colors.textLight}
                value={q.question}
                onChangeText={(t) => updateQuestion(qIdx, { question: t })}
                multiline
                testID={`quiz-q-${qIdx}-text`}
              />
              <Text style={[styles.editCardLabel, { marginTop: 10 }]}>
                Opções (toque na ✓ para marcar a correta)
              </Text>
              {q.options.map((o, oIdx) => (
                <View key={oIdx} style={styles.optionEditRow}>
                  <TouchableOpacity
                    onPress={() => updateQuestion(qIdx, { correct_index: oIdx })}
                    style={[
                      styles.correctToggle,
                      q.correct_index === oIdx && styles.correctToggleActive,
                    ]}
                    testID={`quiz-q-${qIdx}-correct-${oIdx}`}
                  >
                    <Ionicons
                      name="checkmark"
                      size={16}
                      color={q.correct_index === oIdx ? '#fff' : theme.colors.textLight}
                    />
                  </TouchableOpacity>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder={`Opção ${oIdx + 1}`}
                    placeholderTextColor={theme.colors.textLight}
                    value={o}
                    onChangeText={(t) => updateOption(qIdx, oIdx, t)}
                    testID={`quiz-q-${qIdx}-option-${oIdx}`}
                  />
                </View>
              ))}
            </View>
          ))}
          <TouchableOpacity style={styles.addQuestionBtn} onPress={addQuestion} testID="quiz-add-q">
            <Ionicons name="add-circle-outline" size={18} color={theme.colors.primary} />
            <Text style={styles.addQuestionText}>Adicionar pergunta</Text>
          </TouchableOpacity>
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.btnOutline} onPress={cancelEdit} disabled={saving}>
              <Text style={styles.btnOutlineText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnPrimary, saving && { opacity: 0.6 }]}
              onPress={save}
              disabled={saving}
              testID="quiz-save"
            >
              <Text style={styles.btnPrimaryText}>{saving ? 'A guardar...' : 'Guardar teste'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* View mode (idle) */}
      {!editing && !taking && quiz.length > 0 && (
        <TouchableOpacity style={styles.startBtn} onPress={startTest} testID="quiz-start">
          <Ionicons name="play-circle" size={20} color="#fff" />
          <Text style={styles.startBtnText}>Iniciar teste</Text>
        </TouchableOpacity>
      )}
      {!editing && !taking && quiz.length === 0 && (
        <Text style={styles.emptyText}>
          Ainda não há perguntas. Toque no ícone de editar para criar o seu teste.
        </Text>
      )}

      {/* Take mode */}
      {!editing && taking && (
        <View>
          {quiz.map((q, qIdx) => {
            const userAns = answers[qIdx];
            return (
              <View key={qIdx} style={styles.takeCard}>
                <Text style={styles.takeQNum}>Pergunta {qIdx + 1}</Text>
                <Text style={styles.takeQText}>{q.question}</Text>
                {q.options.map((o, oIdx) => {
                  const isSelected = userAns === oIdx;
                  const isCorrect = oIdx === q.correct_index;
                  let bg = theme.colors.surface;
                  let border = theme.colors.border;
                  if (submitted) {
                    if (isCorrect) {
                      bg = '#DCFCE7';
                      border = '#16A34A';
                    } else if (isSelected && !isCorrect) {
                      bg = '#FEE2E2';
                      border = '#DC2626';
                    }
                  } else if (isSelected) {
                    bg = '#E0F2FE';
                    border = theme.colors.secondary;
                  }
                  return (
                    <TouchableOpacity
                      key={oIdx}
                      style={[styles.optionRow, { backgroundColor: bg, borderColor: border }]}
                      onPress={() => !submitted && setAnswers((a) => ({ ...a, [qIdx]: oIdx }))}
                      disabled={submitted}
                      testID={`quiz-take-q-${qIdx}-o-${oIdx}`}
                    >
                      <View
                        style={[
                          styles.radio,
                          isSelected && { borderColor: theme.colors.secondary },
                        ]}
                      >
                        {isSelected && <View style={styles.radioDot} />}
                      </View>
                      <Text style={styles.optionText}>{o}</Text>
                      {submitted && isCorrect && (
                        <Ionicons name="checkmark-circle" size={18} color="#16A34A" />
                      )}
                      {submitted && isSelected && !isCorrect && (
                        <Ionicons name="close-circle" size={18} color="#DC2626" />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            );
          })}

          {!submitted ? (
            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.btnOutline} onPress={resetTest}>
                <Text style={styles.btnOutlineText}>Sair</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.btnPrimary,
                  Object.keys(answers).length < quiz.length && { opacity: 0.5 },
                ]}
                onPress={submitTest}
                disabled={Object.keys(answers).length < quiz.length}
                testID="quiz-submit"
              >
                <Text style={styles.btnPrimaryText}>Validar respostas</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <View style={styles.scoreCard} testID="quiz-score">
                <Text style={styles.scoreLabel}>RESULTADO</Text>
                <Text style={styles.scoreValue}>
                  {score} / {quiz.length}
                </Text>
                <Text style={styles.scorePercent}>
                  {Math.round((score / quiz.length) * 100)}% de acerto
                </Text>
                {savedAttempt && (
                  <Text style={styles.scoreSaved}>
                    ✓ +{score} pontos adicionados ao seu total
                  </Text>
                )}
                {!isAuthed && (
                  <Text style={styles.scoreSaved}>
                    💡 Faça login para guardar a pontuação
                  </Text>
                )}
              </View>
              <View style={styles.actionsRow}>
                <TouchableOpacity style={styles.btnOutline} onPress={resetTest}>
                  <Text style={styles.btnOutlineText}>Fechar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnPrimary} onPress={startTest} testID="quiz-retry">
                  <Text style={styles.btnPrimaryText}>Tentar novamente</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    padding: 16,
    marginTop: 16,
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  eyebrow: { fontSize: 11, fontWeight: '800', color: theme.colors.primary, letterSpacing: 2 },
  title: { fontSize: 18, fontWeight: '800', color: theme.colors.secondary, marginTop: 4 },
  editIcon: {
    width: 36, height: 36, borderRadius: 4,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyText: { fontSize: 13, color: theme.colors.textLight, fontStyle: 'italic', paddingVertical: 8 },

  startBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: theme.colors.primary, paddingVertical: 14, borderRadius: 6,
  },
  startBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  takeCard: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: 8, padding: 14, marginBottom: 10,
  },
  takeQNum: { fontSize: 11, fontWeight: '800', color: theme.colors.primary, letterSpacing: 1.5 },
  takeQText: { fontSize: 15, fontWeight: '700', color: theme.colors.secondary, marginTop: 4, marginBottom: 12 },
  optionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderRadius: 6, padding: 12, marginBottom: 6,
  },
  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: theme.colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.secondary },
  optionText: { flex: 1, fontSize: 14, color: theme.colors.textMain },

  scoreCard: {
    backgroundColor: theme.colors.secondary,
    borderRadius: 8, padding: 18, alignItems: 'center', marginVertical: 12,
  },
  scoreLabel: { color: '#fff', opacity: 0.7, fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  scoreValue: { color: '#fff', fontSize: 36, fontWeight: '900', marginTop: 4 },
  scorePercent: { color: '#fff', opacity: 0.9, fontSize: 13, marginTop: 2 },
  scoreSaved: { color: '#fff', fontSize: 12, marginTop: 8, fontStyle: 'italic' },

  // Edit
  editCard: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8,
    padding: 12, marginBottom: 10, backgroundColor: theme.colors.surfaceAlt,
  },
  editCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  editCardLabel: { fontSize: 12, fontWeight: '700', color: theme.colors.secondary },
  removeBtn: { padding: 6, borderRadius: 4, backgroundColor: '#FEF2F2' },
  input: {
    borderWidth: 1, borderColor: theme.colors.border, backgroundColor: '#fff',
    borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8,
    fontSize: 14, color: theme.colors.textMain, minHeight: 38,
  },
  optionEditRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  correctToggle: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 2, borderColor: theme.colors.border,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff',
  },
  correctToggleActive: { backgroundColor: '#16A34A', borderColor: '#16A34A' },
  addQuestionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: 6, borderWidth: 2, borderStyle: 'dashed',
    borderColor: theme.colors.primary, marginTop: 4,
  },
  addQuestionText: { color: theme.colors.primary, fontWeight: '800', fontSize: 13 },

  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  btnOutline: {
    flex: 1, paddingVertical: 12, alignItems: 'center',
    borderWidth: 1, borderColor: theme.colors.secondary, borderRadius: 4,
  },
  btnOutlineText: { color: theme.colors.secondary, fontWeight: '700' },
  btnPrimary: {
    flex: 2, paddingVertical: 12, alignItems: 'center',
    backgroundColor: theme.colors.primary, borderRadius: 4,
  },
  btnPrimaryText: { color: '#fff', fontWeight: '700' },
});
