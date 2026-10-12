import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, LockKeyhole } from 'lucide-react';
import { apiBaseUrl } from '../config/api';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const response = await fetch(`${apiBaseUrl}/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.message ?? 'Could not reset password');
        return;
      }

      navigate('/login');
    } catch {
      setError('Could not reach the RehabQuest API');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-background px-5 py-10 text-on-background">
      <section className="mx-auto max-w-[520px] rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6 shadow-ambient md:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">New password</p>
        <h1 className="mt-2 font-display text-[2.3rem] font-bold leading-tight text-on-background">
          Choose a new password
        </h1>
        <p className="mt-2 text-sm font-semibold text-on-surface-variant">
          Paste your reset token and enter the password you want to use.
        </p>

        <form onSubmit={handleSubmit} className="mt-7 grid gap-4">
          <label className="grid gap-2">
            <span className="text-sm font-bold text-on-surface">Reset token</span>
            <input
              value={token}
              onChange={(event) => setToken(event.target.value)}
              className="h-12 rounded-xl border border-outline-variant/50 bg-surface-container-lowest px-4 text-on-surface shadow-ambient outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-bold text-on-surface">New password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-12 rounded-xl border border-outline-variant/50 bg-surface-container-lowest px-4 text-on-surface shadow-ambient outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
            />
          </label>

          {error ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 font-display text-sm font-semibold text-on-primary shadow-md transition hover:shadow-ambient-lg active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <LockKeyhole className="h-5 w-5" />}
            Reset Password
          </button>
        </form>

        <p className="mt-5 text-center text-sm font-semibold text-on-surface-variant">
          Need a token?{' '}
          <Link to="/forgot-password" className="text-primary">
            Start password reset
          </Link>
        </p>
      </section>
    </main>
  );
}
