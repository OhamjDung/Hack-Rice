export default function LeakIndicator({ leak }: { leak: number }) {
  const leaking = leak > 0.5;
  return (
    <div className={`fg-leak${leaking ? '' : ' clear'}`}>
      {leaking ? `Leaking $${leak.toFixed(0)}/mo — unallocated income. Assign it somewhere.` : 'Fully allocated — no leak this month.'}
    </div>
  );
}
