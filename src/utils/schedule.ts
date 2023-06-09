export interface Period {
  open: {
    day: number; time: string;
  };
  close: {
    day: number; time: string;
  };
}

export interface BusinessHours {
  periods: Period[]
}
