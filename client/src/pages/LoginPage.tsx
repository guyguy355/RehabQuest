import { Loader2, LogIn } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getHomeRouteForRole, saveSession } from '../auth/session';
import { apiBaseUrl } from '../config/api';

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setIsSubmitting(true);

    try {
      const response = await fetch(`${apiBaseUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message ?? 'Could not sign in');
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
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Welcome back</p>
        <h1 className="mt-2 font-display text-[2rem] font-bold leading-tight text-on-background sm:text-[2.3rem]">
          Sign in to RehabQuest
        </h1>
        <p className="mt-2 text-sm font-semibold text-on-surface-variant">
          Continue your care plan or manage patient progress.
        </p>

        <form onSubmit={handleSubmit} className="mt-7 grid gap-4">
          <label className="grid gap-2">
            <span className="text-sm font-bold text-on-surface">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-12 w-full min-w-0 rounded-xl border border-outline-variant/50 bg-surface-container-lowest px-4 text-on-surface shadow-ambient outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
              placeholder="you@example.com"
              required
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-bold text-on-surface">Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-12 w-full min-w-0 rounded-xl border border-outline-variant/50 bg-surface-container-lowest px-4 text-on-surface shadow-ambient outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
              placeholder="Enter your password"
              required
            />
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
            {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
            Sign In
          </button>
        </form>

        <p className="mt-5 text-center text-sm font-semibold text-on-surface-variant">
          Need an account?{' '}
          <Link to="/register" className="text-primary">
            Create one
          </Link>
        </p>
      </section>
    </main>
  );
}
