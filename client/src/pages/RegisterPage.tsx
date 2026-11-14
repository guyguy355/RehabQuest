import { Loader2, UserPlus } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getHomeRouteForRole, saveSession } from '../auth/session';
import { apiBaseUrl } from '../config/api';

type RegisterRole = 'PATIENT' | 'THERAPIST';

export function RegisterPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<RegisterRole>('PATIENT');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setIsSubmitting(true);

    try {
      const response = await fetch(`${apiBaseUrl}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          email,
          password,
          role,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message ?? 'Could not create account');
        return;
      }

      saveSession(data.token, data.user);
      navigate(getHomeRouteForRole(data.user.role));
    } catch {
      setMessage('Could not reach the RehabQuest API');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-background px-4 py-6 text-on-background sm:px-5 sm:py-10">
      <section className="mx-auto max-w-[520px] rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-ambient sm:p-6 md:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Join RehabQuest</p>
        <h1 className="mt-2 font-display text-[2rem] font-bold leading-tight text-on-background sm:text-[2.3rem]">
          Create your account
        </h1>
        <p className="mt-2 text-sm font-semibold text-on-surface-variant">
          Register as a patient or therapist to start using RehabQuest.
        </p>

        <form onSubmit={handleSubmit} className="mt-7 grid gap-4">
          <TextField label="Name" value={name} onChange={setName} />
          <TextField label="Email" type="email" value={email} onChange={setEmail} />
          <TextField label="Password" type="password" value={password} onChange={setPassword} />

          <label className="grid gap-2">
            <span className="text-sm font-bold text-on-surface">Role</span>
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as RegisterRole)}
              className="h-12 w-full min-w-0 rounded-xl border border-outline-variant/50 bg-surface-container-lowest px-4 text-on-surface shadow-ambient outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
            >
              <option value="PATIENT">Patient</option>
              <option value="THERAPIST">Therapist</option>
            </select>
          </label>

          {message ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {message}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 font-display text-sm font-semibold text-on-primary shadow-md transition hover:shadow-ambient-lg active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <UserPlus className="h-5 w-5" />}
            Create Account
          </button>
        </form>

        <p className="mt-5 text-center text-sm font-semibold text-on-surface-variant">
          Already have an account?{' '}
          <Link to="/login" className="text-primary">
            Sign in
          </Link>
        </p>
      </section>
    </main>
  );
}

function TextField({
  label,
  type = 'text',
  value,
  onChange,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-bold text-on-surface">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full min-w-0 rounded-xl border border-outline-variant/50 bg-surface-container-lowest px-4 text-on-surface shadow-ambient outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
      />
    </label>
  );
}
