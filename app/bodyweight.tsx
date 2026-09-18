import React, { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { AppText, Button, Card, EmptyState, Field, IconButton, Row, Screen, SectionHeader } from '@/components/ui';
import { LineChart } from '@/components/Charts';
import { spacing, usePalette } from '@/theme';
import { useUnit } from '@/stores/profileStore';
import { addBodyweight, deleteBodyweight, listBodyweight, updateBodyweight } from '@/database/repositories/bodyweightRepo';
import { formatDateLong, formatDateShort, toLocalDateKey } from '@/calculations/time';
import { formatWeight, fromDisplayWeight, toDisplayWeight } from '@/calculations/units';
import { bodyweightSchema, parseDecimal } from '@/validation/schemas';
import { friendlyError } from '@/utils/errors';

export default function Bodyweight() {
  const p = usePalette();
  const unit = useUnit();
  const q = useQuery({ queryKey: ['bodyweight'], queryFn: () => listBodyweight() });
  const [weight, setWeight] = useState('');
  const [date, setDate] = useState(toLocalDateKey(new Date()));
  const [note, setNote] = useState('');
  const [editing, setEditing] = useState<string | null>(null);

  const save = async () => {
    const w = parseDecimal(weight);
    const parsed = bodyweightSchema.safeParse({ weight: w ?? Number.NaN, date, note });
    if (!parsed.success) return Alert.alert('Check the form', parsed.error.issues[0]?.message ?? 'Invalid input');
    try {
      const kg = fromDisplayWeight(parsed.data.weight, unit);
      if (editing) await updateBodyweight(editing, { weight_kg: kg, entry_date: parsed.data.date, note });
      else await addBodyweight(parsed.data.date, kg, note);
      setWeight(''); setNote(''); setEditing(null);
    } catch (e) {
      Alert.alert('Could not save', friendlyError(e));
    }
  };

  const entries = q.data ?? [];
  return (
    <Screen scroll>
      <Row style={{ justifyContent: 'space-between' }}>
        <IconButton icon="arrow-back" label="Back" onPress={() => router.back()} />
        <AppText variant="title">Bodyweight</AppText>
        <View style={{ width: 44 }} />
      </Row>
      <Card style={{ gap: spacing.md, marginTop: spacing.md }}>
        <Row>
          <Field style={{ flex: 1 }} label={`Weight (${unit})`} value={weight} onChangeText={setWeight} keyboardType="decimal-pad" />
          <Field style={{ flex: 1 }} label="Date" value={date} onChangeText={setDate} />
        </Row>
        <Field label="Note" value={note} onChangeText={setNote} placeholder="Optional" />
        <Button title={editing ? 'Save changes' : 'Add entry'} onPress={() => void save()} />
        {editing ? <Button variant="ghost" title="Cancel edit" onPress={() => { setEditing(null); setWeight(''); setNote(''); }} /> : null}
      </Card>
      <SectionHeader title="Trend" />
      <LineChart points={[...entries].reverse().map((e) => ({ x: Date.parse(e.entry_date), y: toDisplayWeight(e.weight_kg, unit) }))} format={(v) => v.toFixed(1)} xLabel={(x) => formatDateShort(new Date(x).toISOString())} />
      <SectionHeader title="Entries" />
      {entries.length === 0 ? <EmptyState icon="scale-outline" title="NO ENTRIES" message="Log your bodyweight to see the trend here." /> : entries.map((e) => (
        <Pressable key={e.id} onPress={() => { setEditing(e.id); setWeight(String(toDisplayWeight(e.weight_kg, unit))); setDate(e.entry_date); setNote(e.note); }}>
          <Row style={{ justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderColor: p.border }}>
            <View style={{ flex: 1 }}>
              <AppText style={{ fontWeight: '700' }}>{formatWeight(e.weight_kg, unit, true)}</AppText>
              <AppText variant="caption">{formatDateLong(e.entry_date + 'T12:00:00')}{e.note ? ` · ${e.note}` : ''}</AppText>
            </View>
            <IconButton icon="trash-outline" color={p.danger} label="Delete entry" onPress={() => Alert.alert('Delete entry?', '', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => void deleteBodyweight(e.id) }])} />
          </Row>
        </Pressable>
      ))}
    </Screen>
  );
}
