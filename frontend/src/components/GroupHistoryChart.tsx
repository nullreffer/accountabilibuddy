import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { useAllCheckins } from '../hooks/useCheckins';
import LoadingSpinner from './LoadingSpinner';

const palette = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#0ea5e9', '#8b5cf6', '#14b8a6'];

const addDays = (date: Date, amount: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
};

const GroupHistoryChart = ({ groupId }: { groupId: string }) => {
  const [range, setRange] = useState<'7d' | '30d' | 'all'>('7d');
  const { checkins, loading } = useAllCheckins(groupId, range);

  const chartData = useMemo(() => {
    if (!checkins.length) {
      return [] as Array<Record<string, number | string>>;
    }

    const sorted = [...checkins].sort((left, right) => left.date.localeCompare(right.date));
    const dateKeys = new Set<string>();
    const memberNames = new Map<string, string>();

    sorted.forEach((checkin) => {
      dateKeys.add(checkin.date);
      memberNames.set(checkin.uid, checkin.userDisplayName || 'Member');
    });

    const firstDate = new Date(`${sorted[0].date}T00:00:00`);
    const lastDate = new Date(`${sorted[sorted.length - 1].date}T00:00:00`);
    const startDate =
      range === 'all'
        ? firstDate
        : addDays(new Date(), range === '7d' ? -6 : -29);
    const endDate = range === 'all' ? lastDate : new Date();

    const memberIds = Array.from(memberNames.keys());
    const dataByDate = new Map<string, Record<string, number | string>>();

    let cursor = new Date(startDate);
    while (cursor <= endDate) {
      const key = cursor.toISOString().split('T')[0];
      const row: Record<string, number | string> = { date: key };
      memberIds.forEach((memberId) => {
        row[memberId] = 0;
      });
      dataByDate.set(key, row);
      cursor = addDays(cursor, 1);
    }

    sorted.forEach((checkin) => {
      const row = dataByDate.get(checkin.date);
      if (row) {
        row[checkin.uid] = checkin.status === 'completed' ? 1 : 0;
      }
    });

    return Array.from(dataByDate.values());
  }, [checkins, range]);

  const members = useMemo(() => {
    const map = new Map<string, string>();
    checkins.forEach((checkin) => {
      map.set(checkin.uid, checkin.userDisplayName || 'Member');
    });
    return Array.from(map.entries());
  }, [checkins]);

  if (loading) {
    return <LoadingSpinner label="Loading history chart..." />;
  }

  if (!chartData.length) {
    return <div className="empty-state">Check-in history will appear once activity is logged.</div>;
  }

  return (
    <div className="card">
      <div className="card__header">
        <div>
          <p className="eyebrow">History</p>
          <h3>Group completion trends</h3>
        </div>
        <div className="segmented-control" role="tablist" aria-label="Date range">
          {(['7d', '30d', 'all'] as const).map((value) => (
            <button
              className={`segmented-control__button${range === value ? ' segmented-control__button--active' : ''}`}
              key={value}
              onClick={() => setRange(value)}
              type="button"
            >
              {value.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <div className="chart-card">
        <ResponsiveContainer height={320} width="100%">
          <LineChart data={chartData}>
            <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 12 }} />
            <YAxis allowDecimals={false} domain={[0, 1]} tick={{ fill: '#6b7280', fontSize: 12 }} />
            <Tooltip />
            <Legend formatter={(value) => members.find(([uid]) => uid === value)?.[1] || value} />
            {members.map(([memberId, memberName], index) => (
              <Line
                dataKey={memberId}
                dot={{ r: 4 }}
                key={memberId}
                name={memberName}
                stroke={palette[index % palette.length]}
                strokeWidth={2}
                type="monotone"
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default GroupHistoryChart;
