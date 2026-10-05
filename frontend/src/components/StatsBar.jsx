export default function StatsBar({ weekSummaries, standalone = false }) {
  const ws = weekSummaries?.reduce((s, d) => s + d.studyMinutes, 0) ?? 0;
  const wt = weekSummaries?.filter(d => d.trainingDone).length ?? 0;
  const we = weekSummaries?.reduce((s, d) => s + d.eventCount, 0) ?? 0;

  return (
    <div className={`stats${standalone ? ' standalone' : ''}`}>
      <div className="stat study"><div className="num">{ws}<small>dk</small></div><div className="lbl">Haftalık ders</div></div>
      <div className="stat sport"><div className="num">{wt}<small>/7 gün</small></div><div className="lbl">Spor</div></div>
      <div className="stat evt"><div className="num">{we}</div><div className="lbl">Aktivite</div></div>
    </div>
  );
}
