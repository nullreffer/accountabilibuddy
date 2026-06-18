import type { Schedule } from '../types';

const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const nthLabels = ['First', 'Second', 'Third', 'Fourth', 'Last'];

const decodeMonthlyDay = (encoded: number): string => {
  if (encoded >= 100) {
    const offset = encoded - 100;
    const nth = Math.min(Math.floor(offset / 10), 4);
    const weekday = offset % 10;
    return `${nthLabels[nth]} ${dayLabels[weekday] ?? ''} of each month`;
  }
  return `Day ${encoded} of each month`;
};

const ScheduleCard = ({
  schedule,
  onDelete,
  canEdit
}: {
  schedule: Schedule;
  onDelete: () => void;
  canEdit: boolean;
}) => {
  const dayText =
    schedule.frequency === 'monthly'
      ? decodeMonthlyDay(schedule.daysOfWeek[0] ?? 1)
      : schedule.daysOfWeek.length
        ? schedule.daysOfWeek.map((day) => dayLabels[day]).join(', ')
        : 'Every day';

  return (
    <article className="schedule-card">
      <div>
        <p className="eyebrow">{schedule.frequency}</p>
        <h3>{schedule.name}</h3>
        <p>
          {dayText} at {schedule.time} ({schedule.timezone})
        </p>
      </div>
      {canEdit ? (
        <button className="button button--ghost button--small" onClick={onDelete}>
          Delete
        </button>
      ) : null}
    </article>
  );
};

export default ScheduleCard;
