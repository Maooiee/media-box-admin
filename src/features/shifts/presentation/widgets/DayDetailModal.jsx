import { Plus, Pencil } from 'lucide-react';
import Modal from '../../../../shared/components/Modal';
import Button from '../../../../shared/components/Button';
import ShiftChip from './ShiftChip';
import { kindStyle } from '../../domain/Shift';

export default function DayDetailModal({
  open,
  date,
  shifts,
  onClose,
  onAdd,
  onEdit,
}) {
  const readable = date
    ? new Date(date).toLocaleDateString('en-PH', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={readable}
      subtitle={`${shifts.length} shift${shifts.length === 1 ? '' : 's'} scheduled`}
      maxWidth="max-w-lg"
    >
      <div className="space-y-3">
        {shifts.length === 0 && (
          <div className="text-center py-8 text-textLight text-sm">
            No shifts yet — add one below
          </div>
        )}

        {shifts.map((s) => (
          <div
            key={s.id}
            className="flex items-center gap-3 bg-bg rounded-2xl p-3 hover:bg-border/50 transition cursor-pointer"
            onClick={() => onEdit(s)}
          >
            <div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center text-primary text-sm font-bold shrink-0">
              {s.employeeName?.[0]?.toUpperCase() ?? '?'}
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-semibold text-textDark truncate">
                {s.employeeName}
              </p>
              <p className="text-xs text-textLight truncate">
                {s.name} · {s.startHour}:00 – {s.endHour}:00
              </p>
            </div>

            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${kindStyle(s.kind)}`}>
              {s.kind}
            </span>

            <Pencil size={14} className="text-textLight" />
          </div>
        ))}

        <div className="pt-2">
          <Button icon={Plus} onClick={onAdd} className="w-full">
            Add Shift to This Day
          </Button>
        </div>
      </div>
    </Modal>
  );
}
