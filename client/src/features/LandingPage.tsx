import { Check, ClipboardCheck, HeartPulse, Moon, Route as RouteIcon } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { homePathFor, useAuth } from '../app/AuthProvider';
import { Logo } from '../ui/Logo';
import { Mascot } from '../ui/Mascot';

/** A tiny static preview of the patient path used as the hero illustration. */
function PathPreview() {
  const stations = [
    { state: 'done', x: 0 },
    { state: 'done', x: 44 },
    { state: 'rest', x: 66 },
    { state: 'today', x: 30 },
    { state: 'upcoming', x: -18 },
  ] as const;

  return (
    <div className="relative mx-auto flex w-56 flex-col items-center gap-4 py-2" aria-hidden="true">
      {stations.map((station, index) =>
        station.state === 'rest' ? (
          <div key={index} className="grid h-8 w-8 place-items-center rounded-full bg-grape-50 text-grape-500" style={{ transform: `translateX(${station.x}px)` }}>
            <Moon className="h-4 w-4" />
          </div>
        ) : (
          <div
            key={index}
            className={`grid h-16 w-16 place-items-center rounded-full ${station.state === 'done' ? 'bg-brand-500 text-white' : station.state === 'today' ? 'bg-sun-400 text-ink-900' : 'bg-ink-100 text-ink-300'}`}
            style={{ transform: `translateX(${station.x}px)`, boxShadow: `0 6px 0 0 ${station.state === 'done' ? '#076B5F' : station.state === 'today' ? '#B88700' : '#D3DDDD'}` }}
          >
            {station.state === 'done' ? <Check className="h-8 w-8" strokeWidth={3.5} /> : station.state === 'today' ? <HeartPulse className="h-8 w-8" strokeWidth={2.6} /> : <RouteIcon className="h-7 w-7" />}
          </div>
        ),
      )}
    </div>
  );
}

export function LandingPage() {
  const auth = useAuth();
  if (auth.status === 'authenticated') return <Navigate to={homePathFor(auth.user)} replace />;

  return (
    <div className="min-h-screen bg-canvas">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Logo />
        <Link to="/login" className="btn btn-secondary btn-sm">
          Sign in
        </Link>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-16">
        <section className="grid items-center gap-10 py-8 md:grid-cols-[1.2fr_1fr] md:py-14">
          <div>
            <p className="eyebrow text-brand-700">Home exercise, made friendly</p>
            <h1 className="mt-2 font-display text-5xl font-extrabold leading-[1.02] text-ink-900 sm:text-6xl">
              Your physio plan, one small step a day.
            </h1>
            <p className="mt-4 max-w-xl text-lg text-ink-700">
              Your therapist sets the exercises. RehabQuest turns them into a daily path, records how each one felt, and sends the results back to your therapist.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/register" className="btn btn-primary btn-lg">
                Start as a patient
              </Link>
              <Link to="/login" className="btn btn-secondary btn-lg">
                I already have an account
              </Link>
            </div>
          </div>
          <div className="card relative overflow-hidden bg-brand-50 p-6">
            <div className="absolute -right-2 bottom-2">
              <Mascot mood="cheer" size={110} />
            </div>
            <PathPreview />
          </div>
        </section>

        <section aria-labelledby="how" className="grid gap-4">
          <h2 id="how" className="font-display text-2xl font-bold">How it works</h2>
          <ol className="grid gap-4 md:grid-cols-3">
            {[
              { icon: ClipboardCheck, title: 'Your therapist plans', text: 'Exercises, sets, reps and training days are chosen by your physiotherapist. Rest days are part of the plan.' },
              { icon: RouteIcon, title: 'You follow the path', text: 'Each planned day is a stop on your path. Finish the exercises, then say how it felt on a 0–10 pain scale.' },
              { icon: HeartPulse, title: 'Your therapist reviews', text: 'High pain, "too hard" and stopped exercises are flagged so your therapist can follow up.' },
            ].map((step, index) => (
              <li key={step.title} className="card p-5">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-100 text-brand-700">
                    <step.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="eyebrow">Step {index + 1}</span>
                </div>
                <h3 className="mt-3 font-display text-xl font-bold">{step.title}</h3>
                <p className="mt-1 text-ink-500">{step.text}</p>
              </li>
            ))}
          </ol>
          <p className="text-sm text-ink-500">
            RehabQuest supports a plan from your therapist. It does not diagnose or change your treatment. If something hurts, stop and contact your therapist.
          </p>
        </section>
      </main>
    </div>
  );
}

export function NotFoundPage() {
  const auth = useAuth();
  return (
    <div className="grid min-h-screen place-items-center bg-canvas px-4">
      <div className="card flex max-w-md flex-col items-center gap-3 p-8 text-center">
        <Mascot mood="think" size={96} />
        <h1 className="font-display text-3xl font-bold">This page is not on the path</h1>
        <p className="text-ink-500">The link may be old, or the page may have moved.</p>
        <Link to={auth.status === 'authenticated' ? homePathFor(auth.user) : '/'} className="btn btn-primary">
          Go home
        </Link>
      </div>
    </div>
  );
}
