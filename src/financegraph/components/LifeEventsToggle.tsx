export default function LifeEventsToggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12, color: '#c5d0bf' }}>
      <input type="checkbox" checked={enabled} onChange={e => onChange(e.target.checked)} />
      Life events (job loss, market crash, medical emergency) — off by default
    </label>
  );
}
