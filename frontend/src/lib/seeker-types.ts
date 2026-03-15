// Seeker Type constants - Ported from original BA Hub frontend

export const SeekerType = {
  None: 0,
  Active: 10,
  Passive: 100,
  SEAD: 200,
  Laser: 300,
} as const;

export function seekerTypeToString(type: number): string {
  switch (type) {
    case SeekerType.None:
      return "unitViewer.weapons.types.seeker.none";
    case SeekerType.Active:
      return "unitViewer.weapons.types.seeker.active";
    case SeekerType.Passive:
      return "unitViewer.weapons.types.seeker.passive";
    case SeekerType.SEAD:
      return "unitViewer.weapons.types.seeker.sead";
    case SeekerType.Laser:
      return "unitViewer.weapons.types.seeker.laser";
    default:
      return "unitViewer.weapons.types.seeker.none";
  }
}

/** Returns an i18n key for a tooltip description */
export function seekerTypeDescription(type: number): string {
  switch (type) {
    case SeekerType.Active:
      return 'unitViewer.weapons.types.seeker.desc.active';
    case SeekerType.Passive:
      return 'unitViewer.weapons.types.seeker.desc.passive';
    case SeekerType.SEAD:
      return 'unitViewer.weapons.types.seeker.desc.sead';
    case SeekerType.Laser:
      return 'unitViewer.weapons.types.seeker.desc.laser';
    default:
      return '';
  }
}

export type SeekerTypeValue = typeof SeekerType[keyof typeof SeekerType];