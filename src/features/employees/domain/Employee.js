export function createEmployee(raw) {
  return {
    id: raw.id,
    fullName: raw.full_name,
    employeeId: raw.employee_id,
    email: raw.email,
    position: raw.position,
    schedule: raw.schedule ?? '',
    isAdmin: raw.is_admin ?? false,
    isActive: raw.is_active ?? true,
    joinedDate: raw.joined_date,
    avatarUrl: raw.avatar_url,
    dailyRate: raw.daily_rate != null ? Number(raw.daily_rate) : null,
  };
}