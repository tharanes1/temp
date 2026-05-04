export interface PerformanceMetric {
  label: string;
  value: string | number;
  trend?: string;
  trendType: 'up' | 'down' | 'neutral';
}

export interface DemandPoint {
  id: string;
  latitude: number;
  longitude: number;
  weight: number;
}
