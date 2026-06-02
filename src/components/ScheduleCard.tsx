import type { Schedule } from '../types';

const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const ScheduleCard = ({
  schedule,
  onDelete,
  canEdit
}: {
  schedule: Schedule;
  onDelete: () => void;
  canEdit: boolean;
}) => {
  const dayText = schedule.daysOfWeek.length
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
