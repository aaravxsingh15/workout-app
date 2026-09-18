import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { AuthShell } from '@/components/AuthShell';
import { AppText, Button, Chip, Field, Row, Segmented } from '@/components/ui';
import { useProfileStore } from '@/stores/profileStore';
import { fromDisplayWeight } from '@/calculations/units';
import { parseDecimal, parseIntStrict } from '@/validation/schemas';
import { addBodyweight } from '@/database/repositories/bodyweightRepo';
import { toLocalDateKey } from '@/calculations/time';
import type { TrainingLevel, Unit } from '@/types/domain';
import { spacing } from '@/theme';
import { friendlyError } from '@/utils/errors';

const REST_OPTIONS = [60, 90, 120, 180];

export default function Onboarding() {
  const profile = useProfileStore((s) => s.profile);
  const update = useProfileStore((s) => s.update);
  const [step, setStep] = useState(0);
  const [name, setName] = useState(profile?.display_name ?? '');
  const [units, setUnits] = useState<Unit>('kg');
  const [level, setLevel] = useState<TrainingLevel>('beginner');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [rest, setRest] = useState(90);
  const [busy, setBusy] = useState(false);

  const finish = async () => {
    if (busy) return;
    const h = parseDecimal(height);
    const w = parseDecimal(weight);
    if (Number.isNaN(h) || Number.isNaN(w)) {
      Alert.alert('Check your numbers', 'Height and bodyweight must be numbers (or leave them blank).');
      return;
    }
    setBusy(true);
    try {
      const kg = w !== null ? fromDisplayWeight(w, units) : null;
      await update({
        display_name: name.trim() || profile?.display_name || 'Athlete',
        units,
        training_level: level,
        height_cm: h,
        bodyweight_kg: kg,
        default_rest_sec: rest,
        onboarding_completed: true,
      });
      if (kg) await addBodyweight(toLocalDateKey(new Date()), kg, 'Onboarding');
    } catch (e) {
      Alert.alert('Could not save', friendlyError(e));
      setBusy(false);
    }
  };

  return (
    <AuthShell title={['Let us set you up', 'Training level', 'About you (optional)', 'Rest timer'][step]!} subtitle={`Step ${step + 1} of 4`}>
      {step === 0 && (
        <View style={{ gap: spacing.lg }}>
          <Field label="What should we call you?" value={name} onChangeText={setName} autoComplete="name" />
          <View style={{ gap: 6 }}>
            <AppText variant="label">Weight unit</AppText>
            <Segmented<Unit> options={[{ value: 'kg', label: 'Kilograms (kg)' }, { value: 'lb', label: 'Pounds (lb)' }]} value={units} onChange={setUnits} />
            <AppText variant="caption">Weights are stored in kg internally, so you can switch any time without losing accuracy.</AppText>
          </View>
        </View>
      )}
      {step === 1 && (
        <Row style={{ flexWrap: 'wrap' }}>
          {(['beginner', 'intermediate', 'advanced'] as TrainingLevel[]).map((l) => (
            <Chip key={l} label={l[0]!.toUpperCase() + l.slice(1)} selected={level === l} onPress={() => setLevel(l)} />
          ))}
        </Row>
      )}
      {step === 2 && (
        <View style={{ gap: spacing.lg }}>
          <Field label="Height (cm)" value={height} onChangeText={setHeight} keyboardType="decimal-pad" placeholder="e.g. 178" />
          <Field label={`Bodyweight (${units})`} value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="Optional" />
        </View>
      )}
      {step === 3 && (
        <View style={{ gap: spacing.md }}>
          <AppText variant="muted">Default rest after a completed set. Each exercise can override it.</AppText>
          <Row style={{ flexWrap: 'wrap' }}>
            {REST_OPTIONS.map((r) => (
              <Chip key={r} label={`${r >= 120 ? r / 60 + ' min' : r + ' s'}`} selected={rest === r} onPress={() => setRest(r)} />
            ))}
          </Row>
        </View>
      )}
      <Row style={{ marginTop: spacing.lg }}>
        {step > 0 ? <Button title="Back" variant="secondary" onPress={() => setStep(step - 1)} style={{ flex: 1 }} /> : null}
        {step < 3 ? (
          <Button title="Next" onPress={() => setStep(step + 1)} style={{ flex: 2 }} />
        ) : (
          <Button title="Start training" onPress={finish} loading={busy} style={{ flex: 2 }} />
        )}
      </Row>
    </AuthShell>
  );
}

export { parseIntStrict };
