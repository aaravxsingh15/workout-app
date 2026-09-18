import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { AppText, Button, Card, Chip, EmptyState, Field, Row, Screen, Sheet, SheetItem } from '@/components/ui';
import { spacing, usePalette } from '@/theme';
import {
  createFolder, createRoutine, deleteFolder, deleteRoutine, duplicateRoutine, listFolders, listRoutines, moveRoutineToFolder,
  reorderRoutines, setRoutineArchived, renameRoutine, type RoutineSummary,
} from '@/database/repositories/routineRepo';
import { startWorkoutFlow } from '@/services/workoutFlow';
import { formatDateShort } from '@/calculations/time';
import { friendlyError } from '@/utils/errors';

export default function Routines() {
  const p = usePalette();
  const [search, setSearch] = useState('');
  const [archived, setArchived] = useState(false);
  const [folder, setFolder] = useState<string | 'all' | 'none'>('all');
  const [menu, setMenu] = useState<RoutineSummary | null>(null);
  const [folderName, setFolderName] = useState('');
  const [rename, setRename] = useState<RoutineSummary | null>(null);
  const [newName, setNewName] = useState('');
  const [moveFor, setMoveFor] = useState<RoutineSummary | null>(null);

  const routines = useQuery({ queryKey: ['routines', search, archived], queryFn: () => listRoutines({ search, archived }) });
  const folders = useQuery({ queryKey: ['folders'], queryFn: listFolders });
  const all = (routines.data ?? []).filter((r) => folder === 'all' || (folder === 'none' ? !r.routine.folder_id : r.routine.folder_id === folder));

  const run = (fn: () => Promise<unknown>) => fn().catch((e) => Alert.alert('Something went wrong', friendlyError(e)));

  const create = () =>
    run(async () => {
      const r = await createRoutine('New routine', folder !== 'all' && folder !== 'none' ? folder : null);
      router.push(`/routine/${r.id}`);
    });

  const move = (r: RoutineSummary, d: -1 | 1) => {
    const ids = all.map((x) => x.routine.id);
    const i = ids.indexOf(r.routine.id);
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    void run(() => reorderRoutines(ids));
  };

  return (
    <Screen scroll>
      <Row style={{ justifyContent: 'space-between', marginTop: spacing.sm }}>
        <AppText variant="display">Routines</AppText>
        <Button small icon="add" title="New" onPress={() => void create()} />
      </Row>
      <Field value={search} onChangeText={setSearch} placeholder="Search routines" style={{ marginVertical: spacing.sm }} />
      <Row style={{ flexWrap: 'wrap' }}>
        <Chip label="All" selected={folder === 'all'} onPress={() => setFolder('all')} />
        {(folders.data ?? []).map((f) => (
          <Chip key={f.id} label={f.name} selected={folder === f.id} onPress={() => setFolder(f.id)} />
        ))}
        <Chip label="No folder" selected={folder === 'none'} onPress={() => setFolder('none')} />
        <Chip label={archived ? 'Archived ✓' : 'Archived'} selected={archived} onPress={() => setArchived(!archived)} />
      </Row>
      <Row style={{ marginVertical: spacing.sm }}>
        <Field style={{ flex: 1 }} value={folderName} onChangeText={setFolderName} placeholder="New folder (e.g. Push Pull Legs)" />
        <Button small variant="secondary" title="Add folder" onPress={() => { if (folderName.trim()) { void run(() => createFolder(folderName)); setFolderName(''); } }} />
      </Row>
      {folder !== 'all' && folder !== 'none' ? (
        <Button small variant="ghost" title="Delete this folder (routines are kept)" onPress={() => void run(async () => { await deleteFolder(folder); setFolder('all'); })} />
      ) : null}

      {all.length === 0 ? (
        <EmptyState icon="list-outline" title={archived ? 'NO ARCHIVED ROUTINES' : 'NO ROUTINES'} message="Create a routine to make starting workouts faster." actionLabel={archived ? undefined : 'CREATE ROUTINE'} onAction={() => void create()} />
      ) : (
        all.map((r) => (
          <Card key={r.routine.id} style={{ marginTop: spacing.md, gap: spacing.sm }} onPress={() => router.push(`/routine/${r.routine.id}`)} onLongPress={() => setMenu(r)}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <AppText variant="title" style={{ fontSize: 18 }}>{r.routine.name}</AppText>
                <AppText variant="caption">{r.exerciseCount} exercises · {r.setCount} sets{r.lastPerformedAt ? ` · last ${formatDateShort(r.lastPerformedAt)}` : ''}</AppText>
              </View>
              <Button small variant="ghost" icon="ellipsis-horizontal" title="" onPress={() => setMenu(r)} />
            </Row>
            <AppText variant="muted" numberOfLines={2}>{r.exerciseNames.join(' · ') || 'Empty routine - tap to add exercises'}</AppText>
            <Button small title="Start workout" icon="play" disabled={r.exerciseCount === 0} onPress={() => void startWorkoutFlow({ type: 'routine', routineId: r.routine.id })} />
          </Card>
        ))
      )}

      <Sheet visible={!!menu} onClose={() => setMenu(null)} title={menu?.routine.name}>
        {menu ? (
          <>
            <SheetItem icon="create" label="Edit" onPress={() => { const id = menu.routine.id; setMenu(null); router.push(`/routine/${id}`); }} />
            <SheetItem icon="text" label="Rename" onPress={() => { setRename(menu); setNewName(menu.routine.name); setMenu(null); }} />
            <SheetItem icon="copy" label="Duplicate" onPress={() => { const id = menu.routine.id; setMenu(null); void run(() => duplicateRoutine(id)); }} />
            <SheetItem icon="folder" label="Move to folder" onPress={() => { setMoveFor(menu); setMenu(null); }} />
            <SheetItem icon="arrow-up" label="Move up" onPress={() => move(menu, -1)} />
            <SheetItem icon="arrow-down" label="Move down" onPress={() => move(menu, 1)} />
            <SheetItem icon="archive" label={menu.routine.is_archived ? 'Unarchive' : 'Archive'} onPress={() => { const m = menu; setMenu(null); void run(() => setRoutineArchived(m.routine.id, !m.routine.is_archived)); }} />
            <SheetItem icon="trash" danger label="Delete" onPress={() => { const m = menu; setMenu(null); Alert.alert('Delete routine?', 'Past workouts from this routine are not affected.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => void run(() => deleteRoutine(m.routine.id)) }]); }} />
          </>
        ) : null}
      </Sheet>
      <Sheet visible={!!rename} onClose={() => setRename(null)} title="Rename routine">
        <Field value={newName} onChangeText={setNewName} autoFocus />
        <Button title="Save" style={{ marginTop: spacing.md }} onPress={() => { if (rename && newName.trim()) void run(() => renameRoutine(rename.routine.id, newName)); setRename(null); }} />
      </Sheet>
      <Sheet visible={!!moveFor} onClose={() => setMoveFor(null)} title="Move to folder">
        <SheetItem icon="remove-circle" label="No folder" onPress={() => { if (moveFor) void run(() => moveRoutineToFolder(moveFor.routine.id, null)); setMoveFor(null); }} />
        {(folders.data ?? []).map((f) => <SheetItem key={f.id} icon="folder" label={f.name} onPress={() => { if (moveFor) void run(() => moveRoutineToFolder(moveFor.routine.id, f.id)); setMoveFor(null); }} />)}
        <AppText variant="caption" color={p.textFaint}>Create folders with the field above the list.</AppText>
      </Sheet>
    </Screen>
  );
}
