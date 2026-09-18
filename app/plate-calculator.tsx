import React, { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { AppText, Card, Field, IconButton, Row, Screen, Chip, SectionHeader } from '@/components/ui';
import { spacing, usePalette } from '@/theme';
import { useProfileStore, useUnit } from '@/stores/profileStore';
import { calculatePlates } from '@/calculations/plates';
import { formatNumber, fromDisplayWeight, toDisplayWeight } from '@/calculations/units';
import { parseDecimal } from '@/validation/schemas';

const KG_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];
const LB_PLATES = [45, 35, 25, 10, 5, 2.5];

export default function PlateCalculator() {
  const p = usePalette();
  const unit = useUnit();
  const profile = useProfileStore((s) => s.profile);
  const update = useProfileStore((s) => s.update);
  const [target, setTarget] = useState('');
  const [bar, setBar] = useState(String(toDisplayWeight(profile?.bar_weight_kg ?? 20, unit)));
  const available = unit === 'kg' ? KG_PLATES : LB_PLATES;
  const [enabled, setEnabled] = useState<number[]>(available);
  const t = parseDecimal(target);
  const b = parseDecimal(bar);
  const result = t && b !== null && !Number.isNaN(t) && !Number.isNaN(b) ? calculatePlates(t, b, enabled) : null;

  return (
    <Screen scroll>
      <Row style={{ justifyContent: 'space-between' }}>
        <IconButton icon="arrow-back" label="Back" onPress={() => router.back()} />
        <AppText variant="title">Plate calculator</AppText>
        <View style={{ width: 44 }} />
      </Row>
      <Row style={{ marginTop: spacing.lg }}>
        <Field style={{ flex: 1 }} label={`Target (${unit})`} value={target} onChangeText={setTarget} keyboardType="decimal-pad" placeholder="e.g. 100" />
        <Field style={{ flex: 1 }} label={`Bar (${unit})`} value={bar} onChangeText={(v) => { setBar(v); const n = parseDecimal(v); if (n && !Number.isNaN(n)) void update({ bar_weight_kg: fromDisplayWeight(n, unit) }); }} keyboardType="decimal-pad" />
      </Row>
      <SectionHeader title="Available plates" />
      <Row style={{ flexWrap: 'wrap' }}>
        {available.map((pl) => <Chip key={pl} label={String(pl)} selected={enabled.includes(pl)} onPress={() => setEnabled((e) => (e.includes(pl) ? e.filter((x) => x !== pl) : [...e, pl]))} />)}
      </Row>
      {result ? (
        <Card style={{ marginTop: spacing.xl, gap: spacing.sm }}>
          <AppText variant="label">Load each side</AppText>
          {result.perSide.length === 0 ? <AppText>Just the bar.</AppText> : (
            <Row style={{ flexWrap: 'wrap' }}>
              {result.perSide.map((pl, i) => (
                <View key={i} style={{ minWidth: 48, paddingHorizontal: 10, height: 48, borderRadius: 8, backgroundColor: p.accent, alignItems: 'center', justifyContent: 'center' }}>
                  <AppText color={p.accentText} style={{ fontWeight: '800' }}>{formatNumber(pl)}</AppText>
                </View>
              ))}
            </Row>
          )}
          <AppText variant="muted">Total loaded: {formatNumber(result.total)} {unit}{result.remainder > 0 ? ` · ${formatNumber(result.remainder)} ${unit} short of target with these plates` : ''}</AppText>
        </Card>
      ) : <AppText variant="muted" style={{ marginTop: spacing.xl }}>Enter a target weight to see the plates for each side of the bar.</AppText>}
    </Screen>
  );
}
