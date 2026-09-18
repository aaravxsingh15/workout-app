import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppText, Button, Chip, Field, IconButton, Row, Screen } from '@/components/ui';
import { spacing, usePalette } from '@/theme';
import { usePickerStore } from '@/stores/pickerStore';
import { filterExercises, getAllExercises, getFavoriteIds, getRecentExerciseIds, setFavorite } from '@/database/repositories/exerciseRepo';
import { EQUIPMENT, MUSCLE_GROUPS, type Equipment, type Exercise, type MuscleGroup } from '@/types/domain';
import { EQUIPMENT_LABELS, MUSCLE_LABELS, TRACKING_LABELS } from '@/types/labels';

type Tab = 'all' | 'recent' | 'favorites';

export default function ExercisePicker() {
  const p = usePalette();
  const request = usePickerStore((s) => s.request);
  const [all, setAll] = useState<Exercise[]>([]);
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const [recent, setRecent] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null);
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [selected, setSelected] = useState<Exercise[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void Promise.all([getAllExercises(), getFavoriteIds(), getRecentExerciseIds(15)]).then(([a, f, r]) => {
      setAll(a);
      setFavs(f);
      setRecent(r);
    });
  }, []);

  const list = useMemo(() => {
    let base = filterExercises(all, { search, muscle, equipment });
    if (tab === 'favorites') base = base.filter((e) => favs.has(e.id));
    if (tab === 'recent') {
      const order = new Map(recent.map((id, i) => [id, i]));
      base = base.filter((e) => order.has(e.id)).sort((a, b) => order.get(a.id)! - order.get(b.id)!);
    }
    return base;
  }, [all, search, muscle, equipment, tab, favs, recent]);

  const close = () => {
    usePickerStore.getState().clear();
    router.back();
  };

  const confirm = async (chosen: Exercise[]) => {
    if (busy || !request || chosen.length === 0) return;
    setBusy(true);
    try {
      await request.onPick(chosen);
    } finally {
      usePickerStore.getState().clear();
      router.back();
    }
  };

  const toggleFav = (id: string) => {
    const on = !favs.has(id);
    setFavs((f) => {
      const n = new Set(f);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
    void setFavorite(id, on);
  };

  const press = (e: Exercise) => {
    if (!request) return router.push(`/exercise/${e.id}`);
    if (!request.multi) return void confirm([e]);
    setSelected((s) => (s.some((x) => x.id === e.id) ? s.filter((x) => x.id !== e.id) : [...s, e]));
  };

  return (
    <Screen edges={['top', 'bottom']} padded={false}>
      <Row style={{ paddingHorizontal: spacing.lg, justifyContent: 'space-between' }}>
        <AppText variant="title">{request?.title ?? 'Exercise library'}</AppText>
        <IconButton icon="close" label="Close" onPress={close} />
      </Row>
      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
        <Field value={search} onChangeText={setSearch} placeholder="Search exercises" autoCorrect={false} />
        <Row>
          {(['all', 'recent', 'favorites'] as Tab[]).map((t) => (
            <Chip key={t} label={t[0]!.toUpperCase() + t.slice(1)} selected={tab === t} onPress={() => setTab(t)} />
          ))}
          <Button small variant="ghost" title="+ Custom" onPress={() => router.push('/exercise/edit')} />
        </Row>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginTop: spacing.sm }} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
        {MUSCLE_GROUPS.map((m) => (
          <Chip key={m} label={MUSCLE_LABELS[m]} selected={muscle === m} onPress={() => setMuscle(muscle === m ? null : m)} />
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginVertical: spacing.sm }} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
        {EQUIPMENT.map((q) => (
          <Chip key={q} label={EQUIPMENT_LABELS[q]} selected={equipment === q} onPress={() => setEquipment(equipment === q ? null : q)} />
        ))}
      </ScrollView>
      <FlatList
        data={list}
        keyExtractor={(e) => e.id}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={20}
        ListEmptyComponent={<AppText variant="muted" style={{ textAlign: 'center', padding: spacing.xl }}>No exercises match. Try a different filter or create a custom exercise.</AppText>}
        renderItem={({ item }) => {
          const sel = selected.some((x) => x.id === item.id);
          return (
            <Pressable onPress={() => press(item)} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, minHeight: 60, gap: spacing.md, backgroundColor: sel ? p.surfaceAlt : 'transparent' }}>
              {request?.multi ? <Ionicons name={sel ? 'checkbox' : 'square-outline'} size={24} color={sel ? p.accent : p.textFaint} /> : null}
              <View style={{ flex: 1 }}>
                <AppText style={{ fontWeight: '600' }}>{item.name}</AppText>
                <AppText variant="caption">
                  {MUSCLE_LABELS[item.primary_muscle]} · {EQUIPMENT_LABELS[item.equipment]}
                  {item.tracking_mode !== 'weight_reps' ? ` · ${TRACKING_LABELS[item.tracking_mode]}` : ''}
                  {!item.is_system ? ' · Custom' : ''}
                </AppText>
              </View>
              <IconButton icon={favs.has(item.id) ? 'star' : 'star-outline'} color={favs.has(item.id) ? p.pr : p.textFaint} label="Favorite" onPress={() => toggleFav(item.id)} />
              <IconButton icon="information-circle-outline" color={p.textFaint} label="Exercise details" onPress={() => router.push(`/exercise/${item.id}`)} />
            </Pressable>
          );
        }}
      />
      {request?.multi ? (
        <View style={{ padding: spacing.lg }}>
          <Button title={selected.length ? `${request.confirmLabel ?? 'Add'} ${selected.length}` : 'Select exercises'} disabled={selected.length === 0} loading={busy} onPress={() => void confirm(selected)} />
        </View>
      ) : null}
    </Screen>
  );
}
