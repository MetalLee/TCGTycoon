export type WorldEvent = {
  id: string;
  day: number;
  type: string;
};

export type WorldHistory = {
  events: WorldEvent[];
};
