export default function StatsCard({ stats }) {
  const total = stats.total || 1;

  const bars = [
    { label: 'Present', value: stats.present, color: 'bg-green-500' },
    { label: 'Late',    value: stats.late,    color: 'bg-yellow-500' },
    { label: 'Absent',  value: stats.absent,  color: 'bg-red-500' },
  ];

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-textDark">Today's Attendance</h3>
        <span className="text-xs text-textLight">{stats.total} total</span>
      </div>

      {/* Stacked bar */}
      <div className="flex h-3 rounded-full overflow-hidden bg-bg mb-5">
        {stats.present > 0 && (
          <div className="bg-green-500" style={{ width: `${(stats.present / total) * 100}%` }} />
        )}
        {stats.late > 0 && (
          <div className="bg-yellow-500" style={{ width: `${(stats.late / total) * 100}%` }} />
        )}
        {stats.absent > 0 && (
          <div className="bg-red-500" style={{ width: `${(stats.absent / total) * 100}%` }} />
        )}
      </div>

      {/* Legend */}
      <div className="space-y-2">
        {bars.map((b) => (
          <div key={b.label} className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${b.color}`} />
            <span className="flex-1 text-sm text-textMedium">{b.label}</span>
            <span className="text-sm font-bold text-textDark">{b.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
