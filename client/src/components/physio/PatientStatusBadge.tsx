import type { PhysioPatient } from '../../services/mockPhysioPatients';

type PatientStatusBadgeProps = {
  status: PhysioPatient['status'];
};

const statusClasses: Record<PhysioPatient['status'], string> = {
  'On Track': 'bg-secondary-container text-on-secondary-container',
  'Needs Attention': 'bg-tertiary-fixed text-on-tertiary-fixed',
  'Missed Tasks': 'bg-red-100 text-red-800',
};

export function PatientStatusBadge({ status }: PatientStatusBadgeProps) {
  return <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusClasses[status]}`}>{status}</span>;
}
