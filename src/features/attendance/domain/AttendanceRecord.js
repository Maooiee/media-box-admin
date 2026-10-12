export function createAttendanceRecord(raw) {
  return {
    id: raw.id,
    date: raw.date,
    timeIn: raw.time_in,
    timeOut: raw.time_out,
    status: raw.status,
    selfieUrl: raw.selfie_url,
    expiresAt: raw.expires_at,
    notes: raw.notes ?? '',
    employeeName: raw.profiles?.full_name ?? 'Unknown',
    employeeId: raw.profiles?.employee_id ?? '',
    position: raw.profiles?.position ?? '',

    // ─── NEW: selfie quality ───
    selfieQualityScore: raw.selfie_quality_score ?? null,
    selfieIssues: raw.selfie_issues ?? [],
  };
}