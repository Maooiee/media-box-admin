export function exportAttendanceCSV(records, filenamePrefix = 'attendance') {
  if (!records || records.length === 0) {
    return false;
  }

  const headers = [
    'Employee',
    'Employee ID',
    'Position',
    'Date',
    'Time In',
    'Time Out',
    'Hours',
    'Status',
    'Notes',
  ];

  function fmtTime(iso) {
    if (!iso) return '--';
    const d = new Date(iso);
    return d.toLocaleTimeString('en-PH', {
      timeZone: 'Asia/Manila',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }

  function hoursWorked(r) {
    if (!r.timeIn || !r.timeOut) return '';
    const ms = new Date(r.timeOut) - new Date(r.timeIn);
    if (ms <= 0) return '';
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return `${h}h ${m}m`;
  }

  // Convert to CSV string with proper escaping
  const escape = (v) => {
    const s = String(v ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const rows = records.map((r) => [
    r.employeeName ?? '',
    r.employeeId ?? '',
    r.position ?? '',
    r.date ?? '',
    fmtTime(r.timeIn),
    fmtTime(r.timeOut),
    hoursWorked(r),
    r.status ?? '',
    r.notes ?? '',
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map(escape).join(','))
    .join('\n');

  // BOM for Excel compatibility with UTF-8
  const blob = new Blob(['\uFEFF' + csv], {
    type: 'text/csv;charset=utf-8;',
  });

  const now = new Date();
  const stamp =
    now.getFullYear() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0') + '_' +
    String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0');

  const filename = `${filenamePrefix}_${stamp}.csv`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return true;
}
