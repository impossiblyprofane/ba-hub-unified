// Trajectory Type constants - Ported from original BA Hub frontend

export const TrajectoryType = {
  None: 0,
  DirectShot: 10,
  Artillery: 20,
  Mortar: 30,
  MLRS: 40,
  PursuitMissile: 100,
  LeadPursuitMissile: 110,
  LeadMissile: 120,
  CruiseMissile: 200,
  BallisticMissile: 300,
  LowDragBomb: 400,
  HighDragBomb: 410,
  LaserProjectile: 600,
  DeadMissile: 666
} as const;

export function trajectoryTypeToString(type: number): string {
  switch (type) {
    case TrajectoryType.None:
      return 'unitViewer.weapons.types.trajectory.none';
    case TrajectoryType.DirectShot:
      return 'unitViewer.weapons.types.trajectory.directShot';
    case TrajectoryType.Artillery:
      return 'unitViewer.weapons.types.trajectory.artillery';
    case TrajectoryType.Mortar:
      return 'unitViewer.weapons.types.trajectory.mortar';
    case TrajectoryType.MLRS:
      return 'unitViewer.weapons.types.trajectory.mlrs';
    case TrajectoryType.PursuitMissile:
      return 'unitViewer.weapons.types.trajectory.pursuitMissile';
    case TrajectoryType.LeadPursuitMissile:
      return 'unitViewer.weapons.types.trajectory.leadPursuitMissile';
    case TrajectoryType.LeadMissile:
      return 'unitViewer.weapons.types.trajectory.leadMissile';
    case TrajectoryType.CruiseMissile:
      return 'unitViewer.weapons.types.trajectory.cruiseMissile';
    case TrajectoryType.BallisticMissile:
      return 'unitViewer.weapons.types.trajectory.ballisticMissile';
    case TrajectoryType.LowDragBomb:
      return 'unitViewer.weapons.types.trajectory.lowDragBomb';
    case TrajectoryType.HighDragBomb:
      return 'unitViewer.weapons.types.trajectory.highDragBomb';
    case TrajectoryType.LaserProjectile:
      return 'unitViewer.weapons.types.trajectory.laserProjectile';
    case TrajectoryType.DeadMissile:
      return 'unitViewer.weapons.types.trajectory.deadMissile';
    default:
      return 'unitViewer.weapons.types.trajectory.none';
  }
}

/** Returns an i18n key for a tooltip description */
export function trajectoryTypeDescription(type: number): string {
  switch (type) {
    case TrajectoryType.DirectShot:
      return 'unitViewer.weapons.types.trajectory.desc.directShot';
    case TrajectoryType.Artillery:
      return 'unitViewer.weapons.types.trajectory.desc.artillery';
    case TrajectoryType.Mortar:
      return 'unitViewer.weapons.types.trajectory.desc.mortar';
    case TrajectoryType.MLRS:
      return 'unitViewer.weapons.types.trajectory.desc.mlrs';
    case TrajectoryType.PursuitMissile:
      return 'unitViewer.weapons.types.trajectory.desc.pursuitMissile';
    case TrajectoryType.LeadPursuitMissile:
      return 'unitViewer.weapons.types.trajectory.desc.leadPursuitMissile';
    case TrajectoryType.LeadMissile:
      return 'unitViewer.weapons.types.trajectory.desc.leadMissile';
    case TrajectoryType.CruiseMissile:
      return 'unitViewer.weapons.types.trajectory.desc.cruiseMissile';
    case TrajectoryType.BallisticMissile:
      return 'unitViewer.weapons.types.trajectory.desc.ballisticMissile';
    case TrajectoryType.LowDragBomb:
      return 'unitViewer.weapons.types.trajectory.desc.lowDragBomb';
    case TrajectoryType.HighDragBomb:
      return 'unitViewer.weapons.types.trajectory.desc.highDragBomb';
    case TrajectoryType.LaserProjectile:
      return 'unitViewer.weapons.types.trajectory.desc.laserProjectile';
    case TrajectoryType.DeadMissile:
      return 'unitViewer.weapons.types.trajectory.desc.deadMissile';
    default:
      return '';
  }
}

export type TrajectoryTypeValue = typeof TrajectoryType[keyof typeof TrajectoryType];