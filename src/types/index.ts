export interface LocationData {
  latitude: number;
  longitude: number;
  heading: number | null;
  speed: number | null;
}

export interface ApiResponse<T> {
  data: T;
  message: string;
  status: number;
}
