/** An optics / sensor package. */
export interface Sensor {
  Id: number;
  Name: string;
  IsDefault: boolean;
  OpticsGround: number;
  OpticsHighAltitude: number;
  OpticsLowAltitude: number;
  ModelFileName: string;
}

/** Junction table — links a Unit to a Sensor. */
export interface SensorUnit {
  Id: number;
  UnitId: number;
  SensorId: number;
}
