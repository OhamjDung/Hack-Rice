import RoundStartAllocation from './RoundStartAllocation';

export default function AuditCorrectionModal({ overContribution, onResolve }: { overContribution: number; onResolve: () => void }) {
  return <RoundStartAllocation mode="correction" overContribution={overContribution} onResolve={onResolve} />;
}
