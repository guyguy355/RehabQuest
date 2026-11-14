import { CalendarDays, CheckCircle2, ClipboardList, Dumbbell, HeartPulse, Loader2, Plus, UserRound } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiFetch, getAuthHeaders } from '../../auth/session';
import { apiBaseUrl } from '../../config/api';
import { MessageThread } from '../messages/MessageThread';

type LinkedPatient = {
  id: string;
  name?: string | null;
  email: string;
};

type TherapistExercise = {
  id: string;
  title: string;
  bodyPart: string;
  difficulty: string;
  sets: number;
  reps: number;
  durationSeconds: number;
};

type AssignedExercise = {
  id: string;
  status: 'ASSIGNED' | 'COMPLETED' | 'SKIPPED';
  dueDate?: string | null;
  notes?: string | null;
  createdAt: string;
  exercise: TherapistExercise;
};

type PatientProgress = {
  id: string;
  status: 'ASSIGNED' | 'COMPLETED' | 'SKIPPED';
  dueDate?: string | null;
  completedAt?: string | null;
  painLevel?: number | null;
  difficultyFeedback?: string | null;
  patientNote?: string | null;
  exerciseTitle: string;
  exerciseBodyPart: string;
};

export function ExerciseAssignmentPanel() {
  const [patients, setPatients] = useState<LinkedPatient[]>([]);
  const [exercises, setExercises] = useState<TherapistExercise[]>([]);
  const [assignments, setAssignments] = useState<AssignedExercise[]>([]);
  const [progress, setProgress] = useState<PatientProgress[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedExerciseId, setSelectedExerciseId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAssignmentsLoading, setIsAssignmentsLoading] = useState(false);
  const [isProgressLoading, setIsProgressLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedPatient = useMemo(
    () => patients.find((patient) => patient.id === selectedPatientId),
    [patients, selectedPatientId],
  );

  async function loadDashboardData() {
    setIsLoading(true);
    setMessage('');
    setIsError(false);

    try {
      const [patientsResponse, exercisesResponse] = await Promise.all([
        apiFetch(`${apiBaseUrl}/therapist/patients`, { headers: getAuthHeaders() }),
        apiFetch(`${apiBaseUrl}/therapist/exercises`, { headers: getAuthHeaders() }),
      ]);
      const patientsData = await patientsResponse.json();
      const exercisesData = await exercisesResponse.json();

      if (!patientsResponse.ok) {
        setMessage(patientsData.message ?? 'Could not load linked patients');
        setIsError(true);
        return;
      }

      if (!exercisesResponse.ok) {
        setMessage(exercisesData.message ?? 'Could not load exercises');
        setIsError(true);
        return;
      }

      const loadedPatients = patientsData.patients ?? [];
      const loadedExercises = exercisesData.exercises ?? [];

      setPatients(loadedPatients);
      setExercises(loadedExercises);
      setSelectedPatientId((current) => current || loadedPatients[0]?.id || '');
      setSelectedExerciseId((current) => current || loadedExercises[0]?.id || '');
    } catch {
      setMessage('Could not reach the RehabQuest API');
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadAssignments(patientId: string) {
    if (!patientId) {
      setAssignments([]);
      setProgress([]);
      return;
    }

    setIsAssignmentsLoading(true);
    setMessage('');
    setIsError(false);

    try {
      const response = await apiFetch(`${apiBaseUrl}/therapist/patients/${patientId}/exercises`, {
        headers: getAuthHeaders(),
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message ?? 'Could not load assigned exercises');
        setIsError(true);
        return;
      }

      setAssignments(data.assignments ?? []);
    } catch {
      setMessage('Could not reach the RehabQuest API');
      setIsError(true);
    } finally {
      setIsAssignmentsLoading(false);
    }
  }

  async function loadProgress(patientId: string) {
    if (!patientId) {
      setProgress([]);
      return;
    }

    setIsProgressLoading(true);
    setMessage('');
    setIsError(false);

    try {
      const response = await apiFetch(`${apiBaseUrl}/therapist/patients/${patientId}/progress`, {
        headers: getAuthHeaders(),
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message ?? 'Could not load patient progress');
        setIsError(true);
        return;
      }

      setProgress(data.progress ?? []);
    } catch {
      setMessage('Could not reach the RehabQuest API');
      setIsError(true);
    } finally {
      setIsProgressLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboardData();
  }, []);

  useEffect(() => {
    void loadAssignments(selectedPatientId);
    void loadProgress(selectedPatientId);
  }, [selectedPatientId]);

  async function handleAssign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setIsError(false);
    setIsSubmitting(true);

    try {
      const response = await apiFetch(`${apiBaseUrl}/therapist/patients/${selectedPatientId}/exercises`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          exerciseId: selectedExerciseId,
          dueDate,
          notes,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message ?? 'Could not assign exercise');
        setIsError(true);
        return;
      }

      setDueDate('');
      setNotes('');
      setMessage('Exercise assigned successfully');
      await loadAssignments(selectedPatientId);
      await loadProgress(selectedPatientId);
    } catch {
      setMessage('Could not reach the RehabQuest API');
      setIsError(true);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-ambient sm:p-6">
      <div className="mb-5">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Assignments</p>
        <h2 className="mt-1 font-display text-2xl font-semibold text-on-surface">Assign exercises</h2>
        <p className="mt-2 text-sm font-semibold text-on-surface-variant">
          Choose a linked patient, assign one of your custom exercises, and track what has been assigned.
        </p>
      </div>

      {message ? (
        <p
          className={[
            'mb-4 rounded-xl px-4 py-3 text-sm font-semibold',
            isError ? 'border border-red-200 bg-red-50 text-red-700' : 'bg-surface-container-low text-on-surface-variant',
          ].join(' ')}
        >
          {message}
        </p>
      ) : null}

      {isLoading ? (
        <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-low p-8 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-3 font-semibold text-on-surface-variant">Loading assignment tools</p>
        </div>
      ) : patients.length === 0 ? (
        <EmptyState title="No linked patients yet" text="Link a patient before assigning exercises." icon={UserRound} />
      ) : exercises.length === 0 ? (
        <EmptyState title="No custom exercises yet" text="Create a custom exercise before assigning it." icon={Dumbbell} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <form onSubmit={handleAssign} className="grid gap-4 rounded-2xl bg-surface-container-low p-4">
            <label className="grid gap-2">
              <span className="text-sm font-bold text-on-surface">Linked patient</span>
              <select
                value={selectedPatientId}
                onChange={(event) => setSelectedPatientId(event.target.value)}
                className="h-12 rounded-xl border border-outline-variant/50 bg-surface-container-lowest px-4 text-on-surface outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
              >
                {patients.map((patient) => (
                  <option key={patient.id} value={patient.id}>
                    {patient.name || patient.email}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-on-surface">Exercise</span>
              <select
                value={selectedExerciseId}
                onChange={(event) => setSelectedExerciseId(event.target.value)}
                className="h-12 rounded-xl border border-outline-variant/50 bg-surface-container-lowest px-4 text-on-surface outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
              >
                {exercises.map((exercise) => (
                  <option key={exercise.id} value={exercise.id}>
                    {exercise.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-on-surface">Due date</span>
              <input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className="h-12 rounded-xl border border-outline-variant/50 bg-surface-container-lowest px-4 text-on-surface outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-on-surface">Notes</span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                className="resize-none rounded-xl border border-outline-variant/50 bg-surface-container-lowest px-4 py-3 text-on-surface outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
              />
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 font-display text-sm font-semibold text-on-primary shadow-md transition hover:shadow-ambient-lg active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
              Assign Exercise
            </button>
          </form>

          <div>
            <div className="mb-3">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Selected patient</p>
              <h3 className="mt-1 font-display text-xl font-semibold text-on-surface">
                {selectedPatient?.name || selectedPatient?.email}
              </h3>
            </div>

            {isAssignmentsLoading ? (
              <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-low p-8 text-center">
                <Loader2 className="mx-auto h-7 w-7 animate-spin text-primary" />
                <p className="mt-3 font-semibold text-on-surface-variant">Loading assigned exercises</p>
              </div>
            ) : assignments.length > 0 ? (
              <div className="grid gap-3">
                {assignments.map((assignment) => (
                  <AssignedExerciseCard key={assignment.id} assignment={assignment} />
                ))}
              </div>
            ) : (
              <EmptyState title="No assigned exercises yet" text="Assign an exercise with the form." icon={ClipboardList} />
            )}

            <PatientProgressSection progress={progress} isLoading={isProgressLoading} />

            {selectedPatientId ? (
              <div className="mt-6">
                <MessageThread
                  userId={selectedPatientId}
                  title="Patient notes"
                  subtitle={`Notes with ${selectedPatient?.name || selectedPatient?.email}`}
                />
              </div>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}

function AssignedExerciseCard({ assignment }: { assignment: AssignedExercise }) {
  return (
    <article className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-ambient">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h4 className="break-words font-display text-xl font-semibold text-on-surface">{assignment.exercise.title}</h4>
          <p className="mt-1 text-sm font-semibold text-on-surface-variant">
            {assignment.exercise.bodyPart} - {assignment.exercise.sets} sets - {assignment.exercise.reps} reps
          </p>
        </div>
        <span className="w-fit rounded-full bg-surface-container-low px-3 py-1 text-xs font-bold text-on-surface-variant">
          {assignment.status}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm font-semibold text-on-surface-variant">
        {assignment.dueDate ? (
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="h-4 w-4 text-primary" />
            Due {new Date(assignment.dueDate).toLocaleDateString()}
          </span>
        ) : null}
        <span>Assigned {new Date(assignment.createdAt).toLocaleDateString()}</span>
      </div>

      {assignment.notes ? <p className="mt-3 text-sm leading-6 text-on-surface-variant">{assignment.notes}</p> : null}
    </article>
  );
}

function PatientProgressSection({ progress, isLoading }: { progress: PatientProgress[]; isLoading: boolean }) {
  const completed = progress.filter((item) => item.status === 'COMPLETED');
  const assigned = progress.filter((item) => item.status !== 'COMPLETED');
  const painReports = progress.filter((item) => item.painLevel);
  const patientNotes = progress.filter((item) => item.patientNote);

  return (
    <section className="mt-6">
      <div className="mb-3">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Progress</p>
        <h3 className="mt-1 font-display text-xl font-semibold text-on-surface">Patient progress</h3>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-low p-8 text-center">
          <Loader2 className="mx-auto h-7 w-7 animate-spin text-primary" />
          <p className="mt-3 font-semibold text-on-surface-variant">Loading patient progress</p>
        </div>
      ) : progress.length > 0 ? (
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <ProgressMetric icon={CheckCircle2} label="Completed" value={String(completed.length)} />
            <ProgressMetric icon={ClipboardList} label="Assigned" value={String(assigned.length)} />
          </div>
          <ProgressList title="Completed exercises" items={completed} emptyText="No completed exercises yet." />
          <ProgressList title="Assigned exercises" items={assigned} emptyText="No active assignments." />
          <FeedbackList title="Pain reports" items={painReports} type="pain" />
          <FeedbackList title="Patient notes" items={patientNotes} type="notes" />
        </div>
      ) : (
        <EmptyState title="No progress yet" text="Assigned exercises and feedback will appear here." icon={ClipboardList} />
      )}
    </section>
  );
}

function ProgressMetric({ icon: Icon, label, value }: { icon: typeof CheckCircle2; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface-container-low p-4">
      <Icon className="h-5 w-5 text-primary" strokeWidth={2.1} />
      <p className="mt-2 text-xs font-bold uppercase tracking-[0.14em] text-on-surface-variant">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold text-on-surface">{value}</p>
    </div>
  );
}

function ProgressList({ title, items, emptyText }: { title: string; items: PatientProgress[]; emptyText: string }) {
  return (
    <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-ambient">
      <h4 className="font-display text-lg font-semibold text-on-surface">{title}</h4>
      {items.length > 0 ? (
        <div className="mt-3 grid gap-3">
          {items.map((item) => (
            <ProgressRow key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm font-semibold text-on-surface-variant">{emptyText}</p>
      )}
    </div>
  );
}

function ProgressRow({ item }: { item: PatientProgress }) {
  return (
    <div className="rounded-xl bg-surface-container-low px-4 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-semibold text-on-surface">{item.exerciseTitle}</p>
          <p className="mt-1 text-sm font-semibold text-on-surface-variant">{item.exerciseBodyPart}</p>
        </div>
        <span className="w-fit rounded-full bg-surface-container-lowest px-3 py-1 text-xs font-bold text-on-surface-variant">
          {item.status}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-sm font-semibold text-on-surface-variant">
        {item.dueDate ? <span>Due {new Date(item.dueDate).toLocaleDateString()}</span> : null}
        {item.completedAt ? <span>Completed {new Date(item.completedAt).toLocaleDateString()}</span> : null}
      </div>
    </div>
  );
}

function FeedbackList({ title, items, type }: { title: string; items: PatientProgress[]; type: 'pain' | 'notes' }) {
  return (
    <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-ambient">
      <h4 className="font-display text-lg font-semibold text-on-surface">{title}</h4>
      {items.length > 0 ? (
        <div className="mt-3 grid gap-3">
          {items.map((item) => (
          <div key={`${type}-${item.id}`} className="rounded-xl bg-surface-container-low px-4 py-3">
              <div className="flex items-start gap-2">
                {type === 'pain' ? (
                  <HeartPulse className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                ) : (
                  <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                )}
                <div className="min-w-0">
                  <p className="break-words font-semibold text-on-surface">{item.exerciseTitle}</p>
                  {type === 'pain' ? (
                    <p className="mt-1 text-sm font-semibold text-on-surface-variant">
                      Pain {item.painLevel}/10{item.difficultyFeedback ? ` - ${item.difficultyFeedback}` : ''}
                    </p>
                  ) : (
                    <p className="mt-1 text-sm leading-6 text-on-surface-variant">{item.patientNote}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm font-semibold text-on-surface-variant">No {title.toLowerCase()} yet.</p>
      )}
    </div>
  );
}

function EmptyState({ title, text, icon: Icon }: { title: string; text: string; icon: typeof UserRound }) {
  return (
    <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-low p-8 text-center">
      <Icon className="mx-auto h-9 w-9 text-primary" />
      <h3 className="mt-3 font-display text-2xl font-semibold text-on-surface">{title}</h3>
      <p className="mt-2 text-on-surface-variant">{text}</p>
    </div>
  );
}

