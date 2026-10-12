import { ArrowRight } from 'lucide-react';
import { type FormEvent, type ReactNode, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError, errorMessage } from '../../app/api';
import { homePathFor, useAuth } from '../../app/AuthProvider';
import { TextField } from '../../ui/Field';
import { Logo } from '../../ui/Logo';
import { Mascot } from '../../ui/Mascot';
import { InlineMessage, Spinner } from '../../ui/States';

function AuthLayout({ title, subtitle, children, mood = 'wave' }: { title: string; subtitle: string; children: ReactNode; mood?: 'wave' | 'think' | 'calm' }) {
  return (
    <div className="min-h-screen bg-canvas px-4 py-8">
      <div className="mx-auto flex max-w-md flex-col gap-6">
        <Link to="/" className="self-start" aria-label="RehabQuest home">
          <Logo />
        </Link>
        <main className="card p-6 sm:p-8">
          <div className="mb-6 flex items-center gap-4">
            <Mascot mood={mood} size={72} />
            <div>
              <h1 className="font-display text-3xl font-bold leading-tight">{title}</h1>
              <p className="text-ink-500">{subtitle}</p>
            </div>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}

function safeNext(value: string | null) {
  // Only allow in-app paths to prevent open redirects.
  return value && value.startsWith('/') && !value.startsWith('//') ? value : null;
}

export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const reason = params.get('reason');
  const next = safeNext(params.get('next'));

  if (auth.status === 'authenticated') {
    return <Navigate to={homePathFor(auth.user)} replace />;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setError('');
    setSubmitting(true);
    try {
      const user = await auth.login(email, password);
      const home = homePathFor(user);
      navigate(next && next.startsWith(home) ? next : home, { replace: true });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to continue your plan.">
      <form onSubmit={submit} className="grid gap-4" noValidate>
        {reason === 'expired' ? <InlineMessage tone="info">Your session ended. Please sign in again.</InlineMessage> : null}
        {reason === 'unreachable' ? <InlineMessage tone="error">We could not reach the server. Check that the API is running, then sign in.</InlineMessage> : null}
        <TextField label="Email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <TextField label="Password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        {error ? <InlineMessage tone="error">{error}</InlineMessage> : null}
        <button type="submit" className="btn btn-primary btn-lg w-full" disabled={submitting || !email || !password}>
          {submitting ? <Spinner /> : null}
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
        <div className="flex flex-wrap justify-between gap-2 text-sm font-bold">
          <Link to="/forgot-password" className="text-brand-700 underline-offset-4 hover:underline">
            Forgot password?
          </Link>
          <Link to="/register" className="text-brand-700 underline-offset-4 hover:underline">
            New patient? Create an account
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
}

export function RegisterPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (auth.status === 'authenticated') {
    return <Navigate to={homePathFor(auth.user)} replace />;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setError('');
    setFields({});
    if (form.password.length < 8) {
      setFields({ password: 'Use at least 8 characters' });
      return;
    }
    setSubmitting(true);
    try {
      await auth.register(form);
      navigate('/patient', { replace: true });
    } catch (caught) {
      if (caught instanceof ApiError && Object.keys(caught.fields).length > 0) setFields(caught.fields);
      else setError(errorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  const update = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) => setForm((current) => ({ ...current, [key]: event.target.value }));

  return (
    <AuthLayout title="Join as a patient" subtitle="Your therapist adds your exercise plan.">
      <form onSubmit={submit} className="grid gap-4" noValidate>
        <TextField label="Your name" autoComplete="name" value={form.name} onChange={update('name')} error={fields.name} required />
        <TextField label="Email" type="email" autoComplete="email" value={form.email} onChange={update('email')} error={fields.email} required />
        <TextField label="Password" type="password" autoComplete="new-password" value={form.password} onChange={update('password')} error={fields.password} hint="At least 8 characters." required />
        {error ? <InlineMessage tone="error">{error}</InlineMessage> : null}
        <button type="submit" className="btn btn-primary btn-lg w-full" disabled={submitting}>
          {submitting ? <Spinner /> : null}
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
        <p className="rounded-2xl bg-ink-50 p-3 text-sm text-ink-500">
          Therapist? Therapist accounts are set up by your clinic administrator, not through this form.
        </p>
        <Link to="/login" className="text-center text-sm font-bold text-brand-700 underline-offset-4 hover:underline">
          Already have an account? Sign in
        </Link>
      </form>
    </AuthLayout>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<{ message: string; devResetToken?: string } | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      setResult(await api('/auth/forgot-password', { method: 'POST', body: { email }, anonymous: true }));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout title="Reset password" subtitle="We'll create a reset link for your account." mood="think">
      <form onSubmit={submit} className="grid gap-4" noValidate>
        <TextField label="Email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        {error ? <InlineMessage tone="error">{error}</InlineMessage> : null}
        {result ? (
          <InlineMessage tone="success">
            {result.message}
            {result.devResetToken ? (
              <>
                {' '}
                Development mode:{' '}
                <Link className="underline" to={`/reset-password?token=${result.devResetToken}`}>
                  open the reset page
                </Link>
                .
              </>
            ) : null}
          </InlineMessage>
        ) : null}
        <button type="submit" className="btn btn-primary btn-lg w-full" disabled={submitting || !email}>
          {submitting ? <Spinner /> : null}
          Send reset link
        </button>
        <Link to="/login" className="text-center text-sm font-bold text-brand-700">
          Back to sign in
        </Link>
      </form>
    </AuthLayout>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const [token, setToken] = useState(params.get('token') ?? '');
  const [password, setPassword] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await api('/auth/reset-password', { method: 'POST', body: { token, password }, anonymous: true });
      setDone(true);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout title="Choose a new password" subtitle="Other devices will be signed out." mood="think">
      {done ? (
        <div className="grid gap-4">
          <InlineMessage tone="success">Your password was changed.</InlineMessage>
          <Link to="/login" className="btn btn-primary btn-lg w-full">
            Sign in <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <TextField label="Reset code" value={token} onChange={(event) => setToken(event.target.value)} required />
          <TextField label="New password" type="password" autoComplete="new-password" hint="At least 8 characters." value={password} onChange={(event) => setPassword(event.target.value)} required />
          {error ? <InlineMessage tone="error">{error}</InlineMessage> : null}
          <button type="submit" className="btn btn-primary btn-lg w-full" disabled={submitting || !token || password.length < 8}>
            {submitting ? <Spinner /> : null}
            Save new password
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
