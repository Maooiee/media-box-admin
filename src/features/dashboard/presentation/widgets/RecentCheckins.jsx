import { formatTime, initials } from '../../../../core/utils/formatters';
import { dashboardRepository } from '../../data/dashboardRepository';

export default function RecentCheckins({ records }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-textDark">Recent Check-ins</h3>
        <span className="text-xs text-textLight">{records.length}</span>
      </div>

      {records.length === 0 ? (
        <p className="text-sm text-textLight py-4 text-center">No check-ins yet</p>
      ) : (
        <div className="space-y-3">
          {records.map((r) => {
            const url = dashboardRepository.getSelfieUrl(r.selfie_url);
            return (
              <div key={r.id} className="flex items-center gap-3">
                {url ? (
                  <img
                    src={url}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover border-2 border-border"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center text-primary text-xs font-bold">
                    {initials(r.profiles?.full_name ?? '?')}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-textDark truncate">
                    {r.profiles?.full_name ?? 'Unknown'}
                  </p>
                  <p className="text-xs text-textLight truncate">
                    {formatTime(r.time_in)}
                    {r.time_out ? ` – ${formatTime(r.time_out)}` : ''}
                  </p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                  r.status === 'present' ? 'bg-green-100 text-green-700'
                    : r.status === 'late' ? 'bg-yellow-100 text-yellow-700'
                    : r.status === 'absent' ? 'bg-red-100 text-red-700'
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  {r.status}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
