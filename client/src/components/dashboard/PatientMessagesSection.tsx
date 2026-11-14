import { Loader2, MessageSquare } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiFetch } from '../../auth/session';
import { apiBaseUrl } from '../../config/api';
import { MessageThread } from '../messages/MessageThread';

type ThreadUser = {
  id: string;
  name?: string | null;
  email: string;
};

export function PatientMessagesSection() {
  const [therapist, setTherapist] = useState<ThreadUser | null>(null);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadTherapistThread() {
      try {
        const response = await apiFetch(`${apiBaseUrl}/patient/therapists`);
        const data = await response.json();

        if (!response.ok) {
          setMessage(data.message ?? 'Could not load linked therapists');
          return;
        }

        setTherapist(data.therapists?.[0] ?? null);
      } catch {
        setMessage('Could not reach the RehabQuest API');
      } finally {
        setIsLoading(false);
      }
    }

    void loadTherapistThread();
  }, []);

  if (isLoading) {
    return (
      <section className="md:col-span-12">
        <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-8 text-center shadow-ambient">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-3 font-semibold text-on-surface-variant">Loading messages</p>
        </div>
      </section>
    );
  }

  if (therapist) {
    return (
      <div className="md:col-span-12">
        <MessageThread
          userId={therapist.id}
          title="Therapist notes"
          subtitle={`Notes with ${therapist.name || therapist.email}`}
        />
      </div>
    );
  }

  return (
    <section className="md:col-span-12">
      <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-8 text-center shadow-ambient">
        <MessageSquare className="mx-auto h-9 w-9 text-primary" />
        <h2 className="mt-3 font-display text-2xl font-semibold text-on-surface">No therapist notes yet</h2>
        <p className="mt-2 text-on-surface-variant">
          {message || 'Messages will appear here after your therapist sends a note.'}
        </p>
      </div>
    </section>
  );
}
