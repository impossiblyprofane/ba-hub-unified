/** A playable country / faction (e.g. USA, Russia). */
export interface Country {
  Id: number;
  Name: string;
  FlagFileName: string;
  MaxPoints: number;
  SpecializationsNumber: number;
  Hidden: boolean;
}
