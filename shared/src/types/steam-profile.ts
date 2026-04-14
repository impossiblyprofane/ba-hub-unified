/**
 * Steam profile data resolved from ISteamUser/GetPlayerSummaries.
 * Nullable fields indicate the player is missing from Steam's response
 * (deleted account, private profile, invalid id, or API failure).
 */
export type SteamProfile = {
  steamId: string;
  personaName: string | null;
  /** 32x32 avatar URL */
  avatarIcon: string | null;
  /** 64x64 avatar URL */
  avatarMedium: string | null;
  /** 184x184 avatar URL */
  avatarFull: string | null;
  profileUrl: string | null;
};
