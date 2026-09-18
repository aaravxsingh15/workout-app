import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { AppText, Button, Chip, EmptyState, Field, Row, Screen, Segmented, Sheet } from '@/components/ui';
import { WorkoutCard, dateHeader } from '@/components/WorkoutCard';
import { spacing, usePalette } from '@/theme';
import { distinctRoutineNames, getWorkoutsInRange, listAllCompletedWorkouts, listCompletedWorkouts, type DiaryFilters } from '@/database/repositories/workoutRepo';
import { computeGlobalPRs } from '@/services/stats';
import { MUSCLE_GROUPS, type MuscleGroup } from '@/types/domain';
import { MUSCLE_LABELS } from '@/types/labels';
import { monthName, toLocalDateKey } from '@/calculations/time';
import { startWorkoutFlow } from '@/services/workoutFlow';

const PAGE = 15;
type Range = 'all' | '7' | '30' | '90';

export default function Diary() {
  const p = usePalette();
  const [view, setView] = useState<'timeline' | 'calendar'>('timeline');
  const [search, setSearch] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null);
  const [range, setRange] = useState<Range>('all');
  const [routineId, setRoutineId] = useState<string | null>(null);
  const [prOnly, setPrOnly] = useState(false);
  const [minDur, setMinDur] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [anchor] = useState(() => Date.now());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const prs = useQuery({ queryKey: ['global-prs'], queryFn: async () => computeGlobalPRs(await listAllCompletedWorkouts()) });
  const routines = useQuery({ queryKey: ['diary-routines'], queryFn: distinctRoutineNames });

  const filters: DiaryFilters = useMemo(() => {
    const f: DiaryFilters = { search, muscle, routineId, minDurationMin: minDur };
    if (range !== 'all') f.from = new Date(anchor - Number(range) * 86400000).toISOString();
    if (prOnly) f.onlyIds = [...(prs.data?.perWorkout.keys() ?? [])];
    return f;
  }, [search, muscle, routineId, minDur, range, prOnly, prs.data, anchor]);

  const list = useInfiniteQuery({
    queryKey: ['diary', filters],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => listCompletedWorkouts(filters, PAGE, pageParam),
    getNextPageParam: (last, all) => (last.length === PAGE ? all.length * PAGE : undefined),
  });
  const items = list.data?.pages.flat() ?? [];
  const activeFilters = [muscle, routineId, prOnly || null, minDur, range !== 'all' ? range : null].filter(Boolean).length;

  const [cursor, setCursor] = useState(() => new Date());
  const [day, setDay] = useState<string | null>(toLocalDateKey(new Date()));
  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  const monthWorkouts = useQuery({ queryKey: ['diary-month', monthStart.toISOString()], queryFn: () => getWorkoutsInRange(monthStart.toISOString(), monthEnd.toISOString()), enabled: view === 'calendar' });
  const counts = new Map<string, number>();
  for (const w of monthWorkouts.data ?? []) counts.set(toLocalDateKey(w.started_at), (counts.get(toLocalDateKey(w.started_at)) ?? 0) + 1);
  const dayItems = useQuery({
    queryKey: ['diary-day', day, monthWorkouts.data?.length],
    enabled: view === 'calendar' && !!day,
    queryFn: () => {
      const [y, m, d] = day!.split('-').map(Number);
      const from = new Date(y!, m! - 1, d!);
      const to = new Date(y!, m! - 1, d! + 1);
      return listCompletedWorkouts({ from: from.toISOString(), to: to.toISOString() }, 20, 0);
    },
  });
  const firstWeekday = (monthStart.getDay() + 6) % 7;
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const open = (id: string) => router.push(`/workout/${id}`);
  const empty = (
    <EmptyState icon="book-outline" title={activeFilters || search ? 'NO MATCHING WORKOUTS' : 'NO WORKOUTS YET'} message={activeFilters || search ? 'Try clearing the search or filters.' : 'Your training diary will appear here after your first workout.'} actionLabel={activeFilters || search ? undefined : 'START WORKOUT'} onAction={() => void startWorkoutFlow({ type: 'empty' })} />
  );

  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm, paddingTop: spacing.sm }}>
        <AppText variant="display">Diary</AppText>
        <Segmented value={view} onChange={setView} options={[{ value: 'timeline', label: 'Timeline' }, { value: 'calendar', label: 'Calendar' }]} />
        {view === 'timeline' ? (
          <Row>
            <Field style={{ flex: 1 }} value={search} onChangeText={setSearch} placeholder="Search workouts, exercises, notes" />
            <Button small variant={activeFilters ? 'primary' : 'secondary'} icon="options" title={activeFilters ? `${activeFilters}` : 'Filter'} onPress={() => setShowFilters(true)} />
          </Row>
        ) : null}
      </View>

      {view === 'timeline' ? (
        <FlatList
          data={items}
          keyExtractor={(i) => i.workout.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140, gap: spacing.md }}
          onEndReached={() => list.hasNextPage && void list.fetchNextPage()}
          ListEmptyComponent={list.isLoading ? null : empty}
          renderItem={({ item, index }) => {
            const prev = items[index - 1];
            const header = !prev || toLocalDateKey(prev.workout.started_at) !== toLocalDateKey(item.workout.started_at);
            const isOpen = expanded.has(item.workout.id);
            return (
              <View style={{ gap: spacing.sm }}>
                {header ? <AppText variant="label" style={{ marginTop: spacing.sm }}>{dateHeader(item.workout.started_at)}</AppText> : null}
                <WorkoutCard item={item} expanded={isOpen} prCount={prs.data?.perWorkout.get(item.workout.id) ?? 0} onPress={() => open(item.workout.id)} />
                <Pressable onPress={() => setExpanded((s) => { const n = new Set(s); if (isOpen) n.delete(item.workout.id); else n.add(item.workout.id); return n; })}>
                  <AppText variant="caption" color={p.accent} style={{ textAlign: 'center' }}>{isOpen ? 'Collapse' : 'Expand all sets'}</AppText>
                </Pressable>
              </View>
            );
          }}
        />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140, gap: spacing.md }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Button small variant="secondary" title="‹" onPress={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} />
            <AppText variant="title">{monthName(cursor.getMonth())} {cursor.getFullYear()}</AppText>
            <Button small variant="secondary" title="›" onPress={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} />
          </Row>
          <Row gap={0}>{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <AppText key={i} variant="caption" style={{ flex: 1, textAlign: 'center' }}>{d}</AppText>)}</Row>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {cells.map((d, i) => {
              const key = d ? `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` : null;
              const n = key ? counts.get(key) ?? 0 : 0;
              const sel = key === day;
              return (
                <Pressable key={i} disabled={!d} onPress={() => setDay(key)} style={{ width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' }}>
                  {d ? (
                    <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: n ? p.accent : 'transparent', borderWidth: sel ? 2 : 0, borderColor: p.text }}>
                      <AppText color={n ? p.accentText : p.text} style={{ fontWeight: n ? '800' : '400' }}>{d}</AppText>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
          {day ? <AppText variant="label">{day}</AppText> : null}
          {(dayItems.data ?? []).length === 0 ? <AppText variant="muted">No workouts on this day.</AppText> : null}
          {(dayItems.data ?? []).map((it) => <WorkoutCard key={it.workout.id} item={it} prCount={prs.data?.perWorkout.get(it.workout.id) ?? 0} onPress={() => open(it.workout.id)} />)}
        </ScrollView>
      )}

      <Sheet visible={showFilters} onClose={() => setShowFilters(false)} title="Filters">
        <AppText variant="label">Date range</AppText>
        <Row style={{ flexWrap: 'wrap', marginVertical: spacing.sm }}>
          {([['all', 'All time'], ['7', 'Last 7 days'], ['30', 'Last 30 days'], ['90', 'Last 90 days']] as [Range, string][]).map(([v, l]) => <Chip key={v} label={l} selected={range === v} onPress={() => setRange(v)} />)}
        </Row>
        <AppText variant="label">Muscle group</AppText>
        <Row style={{ flexWrap: 'wrap', marginVertical: spacing.sm }}>
          {MUSCLE_GROUPS.map((m) => <Chip key={m} label={MUSCLE_LABELS[m]} selected={muscle === m} onPress={() => setMuscle(muscle === m ? null : m)} />)}
        </Row>
        {(routines.data ?? []).length > 0 ? (
          <>
            <AppText variant="label">Routine</AppText>
            <Row style={{ flexWrap: 'wrap', marginVertical: spacing.sm }}>
              {routines.data!.map((r) => <Chip key={r.id} label={r.name} selected={routineId === r.id} onPress={() => setRoutineId(routineId === r.id ? null : r.id)} />)}
            </Row>
          </>
        ) : null}
        <AppText variant="label">Duration</AppText>
        <Row style={{ flexWrap: 'wrap', marginVertical: spacing.sm }}>
          {[30, 45, 60, 90].map((m) => <Chip key={m} label={`≥ ${m} min`} selected={minDur === m} onPress={() => setMinDur(minDur === m ? null : m)} />)}
        </Row>
        <Chip label="🏆 PR workouts only" selected={prOnly} onPress={() => setPrOnly(!prOnly)} />
        <Row style={{ marginTop: spacing.lg }}>
          <Button variant="secondary" title="Clear" style={{ flex: 1 }} onPress={() => { setMuscle(null); setRange('all'); setRoutineId(null); setMinDur(null); setPrOnly(false); }} />
          <Button title="Show results" style={{ flex: 2 }} onPress={() => setShowFilters(false)} />
        </Row>
      </Sheet>
    </Screen>
  );
}
