export const STATS_OVERVIEW_QUERY = `
  query StatsOverview {
    analyticsMapRatings {
      id
      name
      count
    }
    analyticsMapTeamSides {
      updateDate
      data {
        map
        winData {
          id
          name
          count
        }
      }
    }
    analyticsSpecUsage {
      id
      name
      count
    }
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
    analyticsCountryStats {
      updateDate
      matchesCount {
        name
        count
      }
      winsCount {
        name
        count
      }
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

/* ─── Snapshot / History queries ──────────────────────────── */

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

export const SNAPSHOT_MAP_HISTORY_QUERY = `
  query SnapshotMapHistory($since: String) {
    snapshotMapHistory(since: $since) {
      mapName
      playCount
      snapshotType
      createdAt
    }
  }
`;

export const SNAPSHOT_FACTION_HISTORY_QUERY = `
  query SnapshotFactionHistory($since: String) {
    snapshotFactionHistory(since: $since) {
      factionName
      matchCount
      winCount
      snapshotType
      createdAt
    }
  }
`;

export const SNAPSHOT_UNIT_RANKINGS_QUERY = `
  query SnapshotUnitRankings($limit: Int) {
    snapshotUnitRankings(limit: $limit) {
      snapshotDate
      units {
        unitName
        timesDeployed
        totalKills
        totalDamageDealt
        totalDamageReceived
        totalSupplyConsumed
        timesRefunded
        avgKills
        avgDamage
      }
    }
  }
`;

// ── Crawler-derived snapshot queries ─────────────────────────

export const CRAWLER_FACTION_HISTORY_QUERY = `
  query CrawlerFactionHistory($since: String) {
    crawlerFactionHistory(since: $since) {
      factionName
      matchCount
      winCount
      snapshotType
      createdAt
    }
  }
`;

export const SNAPSHOT_SPEC_HISTORY_QUERY = `
  query SnapshotSpecHistory($since: String) {
    snapshotSpecHistory(since: $since) {
      specName
      specId
      pickCount
      snapshotType
      createdAt
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
// dev trigger 1775254803
