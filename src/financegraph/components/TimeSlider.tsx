interface Props { month: number; maxMonth: number; onChange: (month: number) => void }

export default function TimeSlider({ month, maxMonth, onChange }: Props) {
  const years = (month / 12).toFixed(1);
  return (
    <div className="fg-slider-row">
      <span className="fg-eyebrow">Time</span>
      <input type="range" min={1} max={maxMonth} value={month} onChange={e => onChange(Number(e.target.value))} />
      <span className="fg-slider-value">Year {years}</span>
    </div>
  );
}
