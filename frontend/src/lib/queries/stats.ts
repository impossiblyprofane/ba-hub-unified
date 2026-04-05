export const STATS_OVERVIEW_QUERY = `
  query StatsOverview {
    analyticsLeaderboard(start: 0, end: 100) {
      rank
      userId
      steamId
      name
      rating
      elo
      level
      winRate
      kdRatio
    }
  }
`;

export const STATS_LEADERBOARD_QUERY = `
  query StatsLeaderboard($start: Int!, $end: Int!) {
    analyticsLeaderboard(start: $start, end: $end) {
      rank
      userId
      steamId
      name
      rating
      elo
      level
      winRate
      kdRatio
    }
  }
`;

export const STATS_PLAYER_LOOKUP_QUERY = `
  query StatsPlayerLookup($marketId: String!) {
    analyticsPlayer(marketId: $marketId) {
      marketId
      name
      level
      kdRatio
      fightsCount
      winsCount
      losesCount
      killsCount
      deathsCount
      totalMatchTimeSec
      capturedZonesCount
      supplyPointsConsumed
      supplyCapturedCount
      supplyCapturedByEnemyCount
      mapsPlayCount {
        id
        name
        count
      }
    }
  }
`;

export const STATS_USER_LOOKUP_QUERY = `
  query StatsUserLookup($steamId: String!) {
    analyticsUserLookup(steamId: $steamId) {
      id
      name
      steamId
      level
      rating
      rank
      marketId
      ratedGames
    }
  }
`;

export const STATS_USER_PROFILE_QUERY = `
  query StatsUserProfile($steamId: String!) {
    analyticsUserProfile(steamId: $steamId) {
      user {
        id
        name
        steamId
        level
        rating
        rank
        marketId
        ratedGames
      }
      stats {
        marketId
        name
        level
        kdRatio
        fightsCount
        winsCount
        losesCount
        killsCount
        deathsCount
        totalMatchTimeSec
        capturedZonesCount
        supplyPointsConsumed
        supplyCapturedCount
        supplyCapturedByEnemyCount
        mapsPlayCount {
          id
          name
          count
        }
      }
      recentFightIds
    }
  }
`;

export const STATS_RECENT_FIGHTS_QUERY = `
  query StatsRecentFights($steamId: String!) {
    analyticsRecentFights(steamId: $steamId) {
      fights {
        fightId
        mapId
        mapName
        totalPlayTimeSec
        endTime
        victoryLevel
        playerCount
        teamSize
        result
        ratingChange
        winnerTeam
        destruction
        losses
        damageDealt
        damageReceived
        allyAvgRating
        enemyAvgRating
        objectivesCaptured
        oldRating
        countryName
        countryFlag
        specNames
        specIcons
      }
      frequentTeammates {
        name
        odId
        steamId
        count
        wins
        losses
      }
      frequentOpponents {
        name
        odId
        steamId
        count
        wins
        losses
      }
      factionBreakdown {
        name
        count
      }
      specUsage {
        name
        specId
        count
      }
      specCombos {
        names
        count
      }
      mostUsedUnits {
        unitId
        unitName
        optionNames
        configKey
        count
        totalKills
        totalDamageDealt
        totalDamageReceived
        avgKills
        avgDamage
        avgDamageReceived
        countryId
        countryName
      }
      topKillerUnits {
        unitId
        unitName
        optionNames
        configKey
        count
        totalKills
        totalDamageDealt
        totalDamageReceived
        avgKills
        avgDamage
        avgDamageReceived
        countryId
        countryName
      }
      topDamageUnits {
        unitId
        unitName
        optionNames
        configKey
        count
        totalKills
        totalDamageDealt
        totalDamageReceived
        avgKills
        avgDamage
        avgDamageReceived
        countryId
        countryName
      }
      topDamageReceivedUnits {
        unitId
        unitName
        optionNames
        configKey
        count
        totalKills
        totalDamageDealt
        totalDamageReceived
        avgKills
        avgDamage
        avgDamageReceived
        countryId
        countryName
      }
    }
  }
`;

export const STATS_FIGHT_DATA_QUERY = `
  query StatsFightData($fightId: String!) {
    analyticsFightData(fightId: $fightId) {
      fightId
      mapId
      mapName
      totalPlayTimeSec
      endTime
      victoryLevel
      endMatchReason
      totalObjectiveZonesCount
      players {
        id
        teamId
        name
        steamId
        destruction
        losses
        oldRating
        newRating
        damageDealt
        damageReceived
        objectivesCaptured
        totalSpawnedUnitScore
        totalRefundedUnitScore
        supplyPointsConsumed
        dlRatio
        medals
        destructionScore
        lossesScore
        supplyConsumedByAllies
        supplyConsumedFromAllies
        countryId
        countryName
        countryFlag
        specNames
        specIcons
        badges
        units {
          id
          unitName
          unitType
          categoryType
          thumbnailFileName
          portraitFileName
          optionIds
          killedCount
          totalDamageDealt
          totalDamageReceived
          supplyPointsConsumed
          wasRefunded
          optionNames
          totalCost
          modList {
            modId
            optId
            cost
            run
            cwun
          }
        }
      }
    }
  }
`;

/* ─── Leaderboard history query (for player profiles) ─────── */

export const SNAPSHOT_LEADERBOARD_HISTORY_QUERY = `
  query SnapshotLeaderboardHistory($steamId: String!, $since: String) {
    snapshotLeaderboardHistory(steamId: $steamId, since: $since) {
      rank
      rating
      elo
      winRate
      kdRatio
      snapshotType
      createdAt
    }
  }
`;

/* ─── Rolling aggregation queries ─────────────────────────── */

export const ROLLING_FACTION_STATS_QUERY = `
  query RollingFactionStats($since: String, $eloBracket: String) {
    rollingFactionStats(since: $since, eloBracket: $eloBracket) {
      rows {
        factionName
        matchCount
        winCount
      }
      since
    }
  }
`;

export const ROLLING_MAP_STATS_QUERY = `
  query RollingMapStats($since: String, $eloBracket: String) {
    rollingMapStats(since: $since, eloBracket: $eloBracket) {
      rows {
        mapName
        playCount
      }
      since
    }
  }
`;

export const ROLLING_SPEC_STATS_QUERY = `
  query RollingSpecStats($since: String, $eloBracket: String) {
    rollingSpecStats(since: $since, eloBracket: $eloBracket) {
      rows {
        specName
        specId
        factionName
        pickCount
      }
      since
    }
  }
`;

export const UNIT_PERFORMANCE_QUERY = `
  query UnitPerformance($since: String, $eloBracket: String, $faction: String, $limit: Int) {
    unitPerformance(since: $since, eloBracket: $eloBracket, faction: $faction, limit: $limit) {
      configKey
      unitId
      unitName
      factionName
      optionIds
      optionNames
      eloBracket
      deployCount
      totalKills
      avgKills
      totalDamageDealt
      avgDamage
      totalDamageReceived
      totalSupplyConsumed
      refundCount
    }
  }
`;
