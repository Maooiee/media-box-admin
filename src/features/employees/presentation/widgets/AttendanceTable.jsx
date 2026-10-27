import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { formatTime } from '../../../../core/utils/formatters';
import { employeeDetailRepository } from '../../data/employeeDetailRepository';
import EditAttendanceModal from '../../../attendance/presentation/widgets/EditAttendanceModal';

export default function AttendanceTable({ records, onChanged }) {
  const [editing, setEditing] = useState(null);

  function hoursWorked(r) {
    if (!r.time_in || !r.time_out) return '--';
    const ms = new Date(r.time_out) - new Date(r.time_in);
    if (ms <= 0) return '--';
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return `${h}h ${m}m`;
  }

  if (records.length === 0) {
    return (
      <div className="text-center py-16 text-textLight text-sm">
        No attendance records in the last 30 days
      </div>
    );
  }

  return (
    <>
      <div className="surface-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-bg text-textLight text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Date</th>
                <th className="text-left px-4 py-3 font-semibold">Time In</th>
                <th className="text-left px-4 py-3 font-semibold">Time Out</th>
                <th className="text-left px-4 py-3 font-semibold">Hours</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
                <th className="text-left px-4 py-3 font-semibold">Selfie</th>
                <th className="text-right px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => {
                const selfieUrl = employeeDetailRepository.getSelfieUrl(r.selfie_url);
                return (
                  <tr key={r.id} className="border-t border-border hover:bg-bg/50">
                    <td className="px-4 py-3 text-textDark whitespace-nowrap font-medium">
                      {r.date}
                    </td>
                    <td className="px-4 py-3 text-textDark whitespace-nowrap">
                      {formatTime(r.time_in)}
                    </td>
                    <td className="px-4 py-3 text-textDark whitespace-nowrap">
                      {formatTime(r.time_out)}
                    </td>
                    <td className="px-4 py-3 text-textMedium whitespace-nowrap">
                      {hoursWorked(r)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                        r.status === 'present' ? 'bg-green-100 text-green-700'
                          : r.status === 'late' ? 'bg-yellow-100 text-yellow-700'
                          : r.status === 'absent' ? 'bg-red-100 text-red-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {selfieUrl ? (
                        <img
                          src={selfieUrl}
                          alt="selfie"
                          className="w-10 h-10 rounded-lg object-cover border border-border cursor-pointer hover:scale-105 transition"
                          onClick={() => window.open(selfieUrl, '_blank')}
                        />
                      ) : (
                        <span className="text-xs text-textLight">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setEditing(r)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:bg-primary-light px-3 py-1.5 rounded-full transition"
                      >
                        <Pencil size={12} /> Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 bg-bg border-t border-border text-xs text-textLight">
          {records.length} record{records.length === 1 ? '' : 's'} in the last 30 days
        </div>
      </div>

      <EditAttendanceModal
        open={!!editing}
        record={editing ? {
          id: editing.id,
          date: editing.date,
          timeIn: editing.time_in,
          timeOut: editing.time_out,
          status: editing.status,
          notes: editing.notes,
          employeeName: 'Employee',
        } : null}
        onClose={() => setEditing(null)}
        onSaved={() => onChanged?.()}
      />
    </>
  );
}
