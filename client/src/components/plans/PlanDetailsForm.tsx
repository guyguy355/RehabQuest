import type { PlanDetails } from '../../services/mockRehabPlanBuilder';

type PlanDetailsFormProps = {
  value: PlanDetails;
  patients: Array<{ id: string; name: string }>;
  onChange: (value: PlanDetails) => void;
};

export function PlanDetailsForm({ value, patients, onChange }: PlanDetailsFormProps) {
  function updateField(field: keyof PlanDetails, fieldValue: string) {
    onChange({ ...value, [field]: fieldValue });
  }

  return (
    <section className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6 shadow-ambient">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Patient & plan details</p>
      <h2 className="mt-1 font-display text-2xl font-semibold text-on-surface">Plan setup</h2>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Field label="Select patient">
          <select
            value={value.patientId}
            onChange={(event) => updateField('patientId', event.target.value)}
            className={fieldClassName}
          >
            {patients.map((patient) => (
              <option key={patient.id} value={patient.id}>
                {patient.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Plan title">
          <input
            value={value.title}
            onChange={(event) => updateField('title', event.target.value)}
            className={fieldClassName}
          />
        </Field>
        <Field label="Injury type">
          <input
            value={value.injuryType}
            onChange={(event) => updateField('injuryType', event.target.value)}
            className={fieldClassName}
          />
        </Field>
        <Field label="Current rehab stage">
          <input
            value={value.rehabStage}
            onChange={(event) => updateField('rehabStage', event.target.value)}
            className={fieldClassName}
          />
        </Field>
        <Field label="Start date">
          <input
            type="date"
            value={value.startDate}
            onChange={(event) => updateField('startDate', event.target.value)}
            className={fieldClassName}
          />
        </Field>
        <Field label="End date">
          <input
            type="date"
            value={value.endDate}
            onChange={(event) => updateField('endDate', event.target.value)}
            className={fieldClassName}
          />
        </Field>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-on-surface">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

const fieldClassName =
  'h-12 w-full rounded-xl border border-outline-variant/50 bg-surface-container-lowest px-4 text-on-surface shadow-ambient outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10';
