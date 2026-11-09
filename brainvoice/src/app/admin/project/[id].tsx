import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';

import { Field } from '@features/butler/Field';
import { useProjectOverview } from '@runtime/adminHooks';
import { runTool } from '@runtime/butler';
import { useLanguage } from '@runtime/hooks';
import { adminCall } from '@runtime/remote';
import { useAppStore } from '@runtime/stores/appStore';
import { useCaptureStore } from '@runtime/stores/captureStore';
import { AppText, Button, Card, Chip, ListRow, Pill, Row, Screen, SectionHeader } from '@ui/primitives';
import { adminUi } from '@ui/adminI18n';
import { spacing, useTheme } from '@ui/theme';

/** Project overview (§113–§126): generated from project data, with quick capture of tasks, decisions, risks, blockers and meeting notes. */
export default function ProjectScreen(): React.JSX.Element {
  const theme = useTheme();
  const language = useLanguage();
  const s = adminUi(language);
  const { id } = useLocalSearchParams<{ id: string }>();
  const projectId = typeof id === 'string' ? id : null;
  const overview = useProjectOverview(projectId);
  const bump = useAppStore((state) => state.bumpData);
  const submitText = useCaptureStore((state) => state.submitText);
  const [task, setTask] = useState('');
  const [decision, setDecision] = useState('');
  const [risk, setRisk] = useState('');
  const [blocker, setBlocker] = useState('');
  const [notes, setNotes] = useState('');
  const [mode, setMode] = useState<'task' | 'decision' | 'risk' | 'blocker' | 'notes'>('task');
  const o = overview.data;
  if (!o || !projectId) return <Screen>{overview.loading ? null : <AppText muted>—</AppText>}</Screen>;

  const ask = (text: string) => {
    router.push('/(tabs)');
    void submitText(text, 'text');
  };
  const toggleTask = async (taskId: string, done: boolean) => {
    await adminCall(done ? 'tasks.reopen' : 'tasks.complete', taskId);
    bump();
  };
  const submit = async () => {
    switch (mode) {
      case 'task':
        if (task.trim()) await runTool('project.addTask', { projectId, title: task.trim() });
        setTask('');
        return;
      case 'decision':
        if (decision.trim()) await runTool('project.addDecision', { projectId, decision: decision.trim() });
        setDecision('');
        return;
      case 'risk':
        if (risk.trim()) await runTool('project.addRisk', { projectId, description: risk.trim() });
        setRisk('');
        return;
      case 'blocker':
        if (blocker.trim()) await runTool('project.addBlocker', { projectId, description: blocker.trim() });
        setBlocker('');
        return;
      case 'notes':
      default:
        if (notes.trim()) await runTool('meeting.extractActions', { projectId, notes: notes.trim() });
        setNotes('');
        return;
    }
  };
  const questions = {
    en: { next: 'What is the next step?', why: 'Why is this project stalled?', decided: 'What did we decide last time?' },
    nl: { next: 'Wat is de volgende stap?', why: 'Waarom staat dit stil?', decided: 'Wat hebben we vorige keer beslist?' },
    fr: { next: 'Quelle est la prochaine étape ?', why: 'Pourquoi ce projet est-il bloqué ?', decided: 'Qu’avons-nous décidé la dernière fois ?' },
  }[language];

  return (
    <Screen>
      <Stack.Screen options={{ title: o.project.name }} />
      <Row style={{ justifyContent: 'space-between' }}>
        <AppText variant="title" style={{ flex: 1 }}>
          {o.project.name}
        </AppText>
        <Pill label={o.project.status} tone={o.project.status === 'active' ? 'success' : 'muted'} />
      </Row>
      {o.project.goal ? <AppText muted>{o.project.goal}</AppText> : null}
      <Card tone={o.attention.length ? 'alt' : 'surface'} style={{ marginTop: spacing.lg }}>
        <AppText variant="bodyStrong">{s.attention}</AppText>
        {o.attention.length === 0 ? <AppText muted>{s.healthy}</AppText> : o.attention.map((a) => <AppText key={a} color={theme.colors.warning}>⚠︎ {a}</AppText>)}
        {o.nextMilestone ? (
          <AppText variant="caption" muted style={{ marginTop: spacing.sm }}>
            {s.nextMilestone}: {o.nextMilestone.title}
            {o.nextMilestone.targetDate ? ` · ${o.nextMilestone.targetDate}` : ''}
          </AppText>
        ) : null}
      </Card>
      <Row gap={spacing.sm} style={{ flexWrap: 'wrap', marginTop: spacing.md }}>
        <Chip label={questions.next} icon="play-outline" onPress={() => ask(questions.next)} />
        <Chip label={questions.why} icon="lock-closed-outline" onPress={() => ask(questions.why)} />
        <Chip label={questions.decided} icon="checkmark-done-outline" onPress={() => ask(questions.decided)} />
      </Row>

      <SectionHeader title={`${s.openTasks} (${o.openTasks.length})`} />
      {o.openTasks.map((t) => (
        <ListRow key={t.id} title={t.title} subtitle={[t.dueDate, t.assignee ?? t.owner, t.dependsOn.length ? '⛓' : null].filter(Boolean).join(' · ')} checked={false} onToggle={() => void toggleTask(t.id, false)} onPress={() => router.push({ pathname: '/task/[id]', params: { id: t.id } })} />
      ))}

      {o.blockers.length ? (
        <>
          <SectionHeader title={s.blockers} />
          {o.blockers.map((b) => (
            <ListRow key={b.id} icon="lock-closed-outline" iconColor={theme.colors.danger} title={b.description} subtitle={[b.kind, b.who].filter(Boolean).join(' · ')} trailing={<Button title="✓" variant="secondary" compact onPress={() => void runTool('project.resolveBlocker', { blockerId: b.id })} />} />
          ))}
        </>
      ) : null}
      {o.waitingFor.length ? (
        <>
          <SectionHeader title={s.waitingFor} />
          {o.waitingFor.map((f) => (
            <ListRow key={f.id} icon="hourglass-outline" title={f.title} subtitle={[f.who, f.expectedDate].filter(Boolean).join(' · ')} trailing={<Button title="✓" variant="secondary" compact onPress={() => void runTool('followup.resolve', { followUpId: f.id })} />} />
          ))}
        </>
      ) : null}
      {o.risks.length ? (
        <>
          <SectionHeader title={s.risks} />
          {o.risks.map((r) => (
            <ListRow key={r.id} icon="warning-outline" iconColor={r.impact === 'high' ? theme.colors.danger : theme.colors.warning} title={r.description} subtitle={`${r.impact} · ${r.likelihood}${r.mitigation ? ` · ${r.mitigation}` : ''}`} />
          ))}
        </>
      ) : null}
      {o.recentDecisions.length ? (
        <>
          <SectionHeader title={s.decisions} />
          {o.recentDecisions.map((d) => (
            <ListRow key={d.id} icon="checkmark-done-outline" title={d.decision} subtitle={[d.decidedOn, d.reason].filter(Boolean).join(' · ')} />
          ))}
        </>
      ) : null}
      {o.milestones.length ? (
        <>
          <SectionHeader title={s.milestones} />
          {o.milestones.map((m) => (
            <ListRow key={m.id} icon={m.status === 'done' ? 'flag' : 'flag-outline'} title={m.title} subtitle={[m.targetDate, m.status].filter(Boolean).join(' · ')} />
          ))}
        </>
      ) : null}
      {o.upcomingMeetings.length ? (
        <>
          <SectionHeader title={s.meetings} />
          {o.upcomingMeetings.map((m) => (
            <ListRow key={m.id} icon="people-outline" title={m.title} subtitle={[m.date, m.time, m.participants.join(', ')].filter(Boolean).join(' · ')} />
          ))}
        </>
      ) : null}
      {o.pendingSuggestions.length ? (
        <>
          <SectionHeader title={s.suggestions} action={s.see} onAction={() => router.push('/admin/suggestions')} />
          {o.pendingSuggestions.slice(0, 5).map((sg) => (
            <ListRow key={sg.id} icon="help-circle-outline" title={sg.title} subtitle={sg.kind} />
          ))}
        </>
      ) : null}

      <SectionHeader title={s.butler} />
      <Row gap={spacing.sm} style={{ flexWrap: 'wrap' }}>
        <Chip label={s.addTask} selected={mode === 'task'} onPress={() => setMode('task')} />
        <Chip label={s.addDecision} selected={mode === 'decision'} onPress={() => setMode('decision')} />
        <Chip label={s.addRisk} selected={mode === 'risk'} onPress={() => setMode('risk')} />
        <Chip label={s.addBlocker} selected={mode === 'blocker'} onPress={() => setMode('blocker')} />
        <Chip label={s.processNotes} selected={mode === 'notes'} onPress={() => setMode('notes')} />
      </Row>
      {mode === 'task' ? <Field label={s.addTask} value={task} onChangeText={setTask} /> : null}
      {mode === 'decision' ? <Field label={s.addDecision} value={decision} onChangeText={setDecision} /> : null}
      {mode === 'risk' ? <Field label={s.addRisk} value={risk} onChangeText={setRisk} /> : null}
      {mode === 'blocker' ? <Field label={s.addBlocker} value={blocker} onChangeText={setBlocker} /> : null}
      {mode === 'notes' ? <Field label={s.processNotes} value={notes} onChangeText={setNotes} multiline placeholder={s.pasteNotes} /> : null}
      <Row style={{ justifyContent: 'flex-end', marginTop: spacing.md }}>
        <Button title={s.save} icon="checkmark" compact onPress={() => void submit()} />
      </Row>
    </Screen>
  );
}
