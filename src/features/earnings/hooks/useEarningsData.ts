import { useState, useEffect } from 'react';
import { useUser } from '@/core/providers/UserContext';
import { COLORS } from '@/shared/theme';

export interface WeeklyData {
  day: string;
  value: number;
  active: boolean;
}

export interface ActivityItem {
  id: number;
  type: 'order' | 'withdrawal';
  title: string;
  subtitle: string;
  amount: string;
  status: string;
  statusColor: string;
}

const WEEKLY_DATA: WeeklyData[] = [
  { day: 'mon', value: 40, active: false },
  { day: 'tue', value: 60, active: false },
  { day: 'wed', value: 35, active: false },
  { day: 'thu', value: 50, active: false },
  { day: 'fri', value: 85, active: true },
  { day: 'sat', value: 45, active: false },
  { day: 'sun', value: 30, active: false },
];

const RECENT_ACTIVITY: ActivityItem[] = [
  { id: 1, type: 'order', title: 'Order #CX901', subtitle: "Today, 2:45 PM • Cravix Express", amount: '₹120.00', status: 'status_added', statusColor: COLORS.primary },
  { id: 2, type: 'order', title: 'Order #CX882', subtitle: 'Today, 1:15 PM • Starbucks', amount: '₹95.00', status: 'status_added', statusColor: COLORS.primary },
  { id: 3, type: 'withdrawal', title: 'Bank Settlement', subtitle: 'Yesterday, 10:20 PM • HDFC ****4312', amount: '-₹5,000', status: 'status_sent', statusColor: COLORS.slate[500] },
];

export function useEarningsData() {
  const { orderStats, secondsOnline } = useUser();
  const [chartData, setChartData] = useState<WeeklyData[]>(WEEKLY_DATA);
  const [activities] = useState<ActivityItem[]>(RECENT_ACTIVITY);

  useEffect(() => {
    const interval = setInterval(() => {
      setChartData((prev) => prev.map((item) => {
        if (item.active) {
          const variation = Math.random() * 2 - 1;
          const newValue = Math.min(Math.max(item.value + variation, 10), 100);
          return { ...item, value: newValue };
        }
        return item;
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h > 0 ? h + 'h ' : ''}${m}m`;
  };

  return {
    orderStats,
    secondsOnline,
    chartData,
    activities,
    formatTime,
  };
}
