import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound, Loader2 } from 'lucide-react';
import { apiBaseUrl } from '../config/api';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setResetToken('');
    setError('');
    setIsSubmitting(true);

    try {
      const response = await fetch(`${apiBaseUrl}/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.message ?? 'Could not create a reset token');
        return;
      }

      setMessage(data.message ?? 'Password reset started');
      setResetToken(data.resetToken ?? '');
    } catch {
      setError('Could not reach the RehabQuest API');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-background px-5 py-10 text-on-background">
      <section className="mx-auto max-w-[520px] rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6 shadow-ambient md:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Account recovery</p>
        <h1 className="mt-2 font-display text-[2.3rem] font-bold leading-tight text-on-background">
          Reset your password
        </h1>
        <p className="mt-2 text-sm font-semibold text-on-surface-variant">
          Enter your email and RehabQuest will create a reset token for testing.
        </p>

        <form onSubmit={handleSubmit} className="mt-7 grid gap-4">
          <label className="grid gap-2">
            <span className="text-sm font-bold text-on-surface">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-12 rounded-xl border border-outline-variant/50 bg-surface-container-lowest px-4 text-on-surface shadow-ambient outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
            />
          </label>

          {error ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {error}
            </p>
          ) : null}

          {message ? (
            <div className="grid gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm font-semibold text-on-surface">
              <p>{message}</p>
              {resetToken ? (
                <p className="break-all rounded-lg bg-surface-container px-3 py-2 font-mono text-xs text-on-surface-variant">
                  {resetToken}
                </p>
              ) : null}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 font-display text-sm font-semibold text-on-primary shadow-md transition hover:shadow-ambient-lg active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <KeyRound className="h-5 w-5" />}
            Create Reset Token
          </button>
        </form>

        <p className="mt-5 text-center text-sm font-semibold text-on-surface-variant">
          Have a token?{' '}
          <Link to="/reset-password" className="text-primary">
            Set a new password
          </Link>
        </p>
      </section>
    </main>
  );
}
