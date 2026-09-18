import React, { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppText, Button, Chip, Field, IconButton, Row, Screen, SwitchRow } from '@/components/ui';
import { spacing } from '@/theme';
import { createCustomExercise, getExercise, updateCustomExercise } from '@/database/repositories/exerciseRepo';
import { exerciseSchema } from '@/validation/schemas';
import { EQUIPMENT, FIELD_KEYS, MUSCLE_GROUPS, TRACKING_MODES, type Equipment, type FieldKey, type MuscleGroup, type TrackingMode } from '@/types/domain';
import { EQUIPMENT_LABELS, FIELD_LABELS, MUSCLE_LABELS, TRACKING_LABELS } from '@/types/labels';
import { friendlyError } from '@/utils/errors';

export default function ExerciseEdit() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [name, setName] = useState('');
  const [primary, setPrimary] = useState<MuscleGroup>('chest');
  const [secondary, setSecondary] = useState<MuscleGroup[]>([]);
  const [equipment, setEquipment] = useState<Equipment>('barbell');
  const [mode, setMode] = useState<TrackingMode>('weight_reps');
  const [fields, setFields] = useState<FieldKey[]>(['weight', 'reps']);
  const [instructions, setInstructions] = useState('');
  const [notes, setNotes] = useState('');
  const [uni, setUni] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    void getExercise(id).then((e) => {
      if (!e) return;
      setName(e.name); setPrimary(e.primary_muscle); setSecondary(e.secondary_muscles); setEquipment(e.equipment);
      setMode(e.tracking_mode); setFields(e.custom_fields); setInstructions(e.instructions); setNotes(e.personal_notes); setUni(e.is_unilateral);
    });
  }, [id]);

  const save = async () => {
    const parsed = exerciseSchema.safeParse({ name, primary_muscle: primary, secondary_muscles: secondary.filter((m) => m !== primary), equipment, tracking_mode: mode, custom_fields: mode === 'custom' ? fields : [], instructions, personal_notes: notes, is_unilateral: uni });
    if (!parsed.success) return Alert.alert('Check the form', parsed.error.issues[0]?.message ?? 'Invalid input');
    if (mode === 'custom' && fields.length === 0) return Alert.alert('Choose fields', 'Pick at least one thing to track.');
    if (busy) return;
    setBusy(true);
    try {
      if (id) await updateCustomExercise(id, parsed.data);
      else await createCustomExercise(parsed.data);
      router.back();
    } catch (e) {
      Alert.alert('Could not save', friendlyError(e));
      setBusy(false);
    }
  };

  const toggle = <T,>(list: T[], v: T, set: (l: T[]) => void) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <Screen scroll>
      <Row style={{ justifyContent: 'space-between' }}>
        <AppText variant="title">{id ? 'Edit exercise' : 'New exercise'}</AppText>
        <IconButton icon="close" label="Close" onPress={() => router.back()} />
      </Row>
      <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Cable Crossover (Low)" />
      <AppText variant="label" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>Primary muscle</AppText>
      <Row style={{ flexWrap: 'wrap' }}>{MUSCLE_GROUPS.map((m) => <Chip key={m} label={MUSCLE_LABELS[m]} selected={primary === m} onPress={() => setPrimary(m)} />)}</Row>
      <AppText variant="label" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>Secondary muscles</AppText>
      <Row style={{ flexWrap: 'wrap' }}>{MUSCLE_GROUPS.filter((m) => m !== primary).map((m) => <Chip key={m} label={MUSCLE_LABELS[m]} selected={secondary.includes(m)} onPress={() => toggle(secondary, m, setSecondary)} />)}</Row>
      <AppText variant="label" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>Equipment</AppText>
      <Row style={{ flexWrap: 'wrap' }}>{EQUIPMENT.map((q) => <Chip key={q} label={EQUIPMENT_LABELS[q]} selected={equipment === q} onPress={() => setEquipment(q)} />)}</Row>
      <AppText variant="label" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>Tracking type</AppText>
      <Row style={{ flexWrap: 'wrap' }}>{TRACKING_MODES.map((t) => <Chip key={t} label={TRACKING_LABELS[t]} selected={mode === t} onPress={() => setMode(t)} />)}</Row>
      {mode === 'custom' ? (
        <View style={{ marginTop: spacing.md }}>
          <AppText variant="label" style={{ marginBottom: spacing.sm }}>Fields to track</AppText>
          <Row style={{ flexWrap: 'wrap' }}>{FIELD_KEYS.map((f) => <Chip key={f} label={FIELD_LABELS[f]} selected={fields.includes(f)} onPress={() => toggle(fields, f, setFields)} />)}</Row>
        </View>
      ) : null}
      <SwitchRow label="Unilateral (left / right)" hint="Log each side as its own set without duplicating the exercise" value={uni} onChange={setUni} />
      <Field label="Instructions" value={instructions} onChangeText={setInstructions} multiline />
      <View style={{ height: spacing.md }} />
      <Field label="Personal notes" value={notes} onChangeText={setNotes} multiline />
      <View style={{ height: spacing.xl }} />
      <Button title="Save exercise" onPress={() => void save()} loading={busy} />
    </Screen>
  );
}
