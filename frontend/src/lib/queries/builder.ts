/**
 * GraphQL query strings for the Deck Builder feature.
 */

/**
 * Main builder data query — fetches everything needed for the deck editor
 * in a single round-trip: countries, specializations (with budget fields),
 * arsenal cards, and unit availabilities for the two selected specs.
 */
export const BUILDER_DATA_QUERY = `
  query BuilderData($countryId: Int!, $spec1Id: Int!, $spec2Id: Int!) {
    builderData(countryId: $countryId, spec1Id: $spec1Id, spec2Id: $spec2Id) {
      countries {
        Id Name FlagFileName MaxPoints Hidden
      }
      specializations {
        Id Name UIName UIDescription Icon Illustration CountryId
        ReconSlots InfantrySlots CombatSlots SupportSlots LogisticsSlots HelicoptersSlots AirSlots MaxSlots
        ReconPoints InfantryPoints CombatPoints SupportPoints LogisticsPoints HelicoptersPoints AirPoints
      }
      arsenalUnitsCards {
        unit {
          Id Name HUDName CountryId CategoryType Type Cost
          ThumbnailFileName PortraitFileName IsUnitModification DisplayInArmory
        }
        isTransport
        specializationIds
        transportCapacity
        cargoCapacity
        availableTransports
        defaultModificationOptions { modId optId optCost optRun optCwun type optThumbnailOverride optPortraitOverride }
      }
      availabilities {
        specAvailabilityId
        specializationId
        unitId
        maxAvailabilityXp0
        maxAvailabilityXp1
        maxAvailabilityXp2
        maxAvailabilityXp3
      }
    }
  }
`;

/**
 * Lightweight query for the New Deck wizard — only countries and specializations.
 * No arsenal cards or availabilities needed until the editor opens.
 */
export const BUILDER_WIZARD_QUERY = `
  query BuilderWizard($countryId: Int!, $spec1Id: Int!, $spec2Id: Int!) {
    builderData(countryId: $countryId, spec1Id: $spec1Id, spec2Id: $spec2Id) {
      countries {
        Id Name FlagFileName MaxPoints Hidden
      }
      specializations {
        Id Name UIName UIDescription Icon Illustration CountryId
        ReconSlots InfantrySlots CombatSlots SupportSlots LogisticsSlots HelicoptersSlots AirSlots MaxSlots
        ReconPoints InfantryPoints CombatPoints SupportPoints LogisticsPoints HelicoptersPoints AirPoints
      }
    }
  }
`;

/**
 * Batch option lookup — used during deck code import to hydrate
 * modification option details (cost, run, cwun) without N+1 calls.
 */
export const OPTIONS_BY_IDS_QUERY = `
  query OptionsByIds($ids: [Int!]!) {
    optionsByIds(ids: $ids) {
      Id ModificationId Name UIName Cost IsDefault Order
      ReplaceUnitName ConcatenateWithUnitName OptionPicture
      ThumbnailOverride PortraitOverride
    }
  }
`;

/**
 * Unit modifications query — fetches all modification slots and their
 * options for a single unit. Used by the UnitEditorPanel to populate
 * modification dropdowns on demand.
 */
export const UNIT_MODIFICATIONS_QUERY = `
  query UnitModifications($unitId: Int!) {
    modifications(unitId: $unitId) {
      Id Name UIName Type Order ThumbnailFileName
      options {
        Id Name UIName Cost IsDefault Order
        ReplaceUnitName ConcatenateWithUnitName OptionPicture
        ThumbnailOverride PortraitOverride
      }
    }
  }
`;

/**
 * Lightweight unit summary query — fetches just the stats needed for
 * the builder floating panel: armor, mobility basics, optics, weapons count.
 * Re-uses the unitDetail resolver but selects minimal fields.
 */
export const BUILDER_UNIT_SUMMARY_QUERY = `
  query BuilderUnitSummary($id: Int!, $optionIds: [Int!]) {
    unitDetail(id: $id, optionIds: $optionIds) {
      displayName
      totalCost
      unit {
        Id Name Type CategoryType Cost
        Weight Stealth InfantrySlots
        ThumbnailFileName PortraitFileName
      }
      armor {
        ArmorValue MaxHealthPoints
        KinArmorFront HeatArmorFront KinArmorRear HeatArmorRear
        KinArmorSides HeatArmorSides KinArmorTop HeatArmorTop
      }
      mobility {
        MaxSpeedRoad MaxCrossCountrySpeed MaxSpeedReverse IsAmphibious IsAirDroppable
        Agility TurnRate LoiteringTime IsAfterburner
      }
      sensors { OpticsGround OpticsLowAltitude OpticsHighAltitude }
      weapons {
        weapon { Id HUDName Type HUDIcon CanShootOnTheMove }
        ammunition {
          quantity
          ammunition {
            HUDName HUDIcon HUDMultiplier Damage GroundRange MinimalRange TargetType ArmorTargeted
            PenetrationAtMinRange PenetrationAtGroundRange
            SupplyCost TopArmorAttack LaserGuided
          }
        }
      }
      abilities {
        ECMAccuracyMultiplier IsRadar IsLaserDesignator IsSmoke IsAPS IsDecoy
      }
      squadMembers {
        Id
        primaryWeapon { Id HUDName Type HUDIcon }
        specialWeapon { Id HUDName Type HUDIcon }
      }
    }
  }
`;
