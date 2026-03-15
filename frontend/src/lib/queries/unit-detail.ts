export const UNIT_DETAIL_QUERY = `
  query UnitDetail($id: Int!, $optionIds: [Int!]) {
    unitDetail(id: $id, optionIds: $optionIds) {
      displayName
      totalCost
      unit {
        Id Name HUDName Description
        CountryId Type CategoryType Role Cost
        PortraitFileName ThumbnailFileName
        Weight Stealth InfantrySlots MaxStress
        Length Width Height
        DisplayInArmory IsUnitModification
      }
      baseUnit { Id Name Cost }
      country { Id Name FlagFileName }
      armor {
        Id Name ArmorValue MaxHealthPoints
        HeatArmorFront HeatArmorRear HeatArmorSides HeatArmorTop
        KinArmorFront KinArmorRear KinArmorSides KinArmorTop
      }
      mobility {
        Id Name IsAmphibious IsAirDroppable Weight HeavyLiftWeight
        TurnRate Acceleration MaxCrossCountrySpeed MaxSpeedRoad
        MaxSpeedReverse MaxSpeedWater Agility ClimbRate
        IsChangeAltitude LoiteringTime IsAfterburner AfterBurningLoiteringTime
      }
      flyPreset {
        Id MaxSpeed AfterburnSpeed CornerSpeed MinSpeed Acceleration Deceleration
      }
      sensors { Id Name OpticsGround OpticsHighAltitude OpticsLowAltitude }
      abilities {
        Id Name IsDefault ECMAccuracyMultiplier
        IsRadar RadarLowAltOpticsModifier RadarHighAltOpticsModifier
        RadarLowAltWeaponRangeModifier RadarHighAltWeaponRangeModifier
        IsRadarStatic RadarSwitchCooldown
        IsLaserDesignator LaserMaxRange LaserUsableInMove
        IsInfantrySprint SprintDuration SprintCooldown
        IsSmoke SmokeAmmunitionQuantity SmokeCooldown
        IsAPS APSQuantity APSCooldown APSHitboxProportion APSSupplyCost APSResupplyTime
        IsDecoy DecoyQuantity DecoyAccuracyMultiplier DecoyCooldown DecoyDuration DecoySupplyCost DecoyResupplyTime
      }
      weapons {
        weapon {
          Id Name HUDName Type HUDIcon
          AutoLoaded IsVerticalLauncher CanShootOnTheMove
          MagazineSize MagazineReloadTimeMin MagazineReloadTimeMax
          AimTimeMin AimTimeMax
          ShotsPerBurstMin ShotsPerBurstMax
          TimeBetweenShotsInBurst TimeBetweenBurstsMin TimeBetweenBurstsMax
          MultiTargetTracking SimultaneousTracking
          CanBeMerged StabilizerQuality
        }
        turret {
          Id Name FullRotation
          LeftHorizontalAngle RightHorizontalAngle HorizontalRotationSpeed
        }
        ammunition {
          order quantity
          ammunition {
            Id Name HUDName HUDIcon
            Damage StressDamage PenetrationAtMinRange PenetrationAtGroundRange
            GroundRange LowAltRange HighAltRange MinimalRange
            TargetType ArmorTargeted TrajectoryType
            TopArmorAttack IsTopArmorArmorAttack LaserGuided CanBeIntercepted
            HealthAOERadius StressAOERadius OverpressureRadius
            RadioFuseDistance DamageOverTimeDuration
            MuzzleVelocity MaxSpeed
            DispersionHorizontalRadius DispersionVerticalRadius
            SupplyCost ResupplyTime
            GenerateSmoke Seeker SeekerAngle
            MaxSeekerDistance CanBeTargeted CanReaquire
            AimStartDelay MainEngineIgnitionDelay
            RotationSpeed BurnTime
            NoDamageFalloff IgnoreCover Airburst
            HUDMultiplier CriticMultiplier
          }
        }
      }
      modifications {
        selectedOptionId
        modification { Id Name UIName Type Order ThumbnailFileName }
        options { Id Name UIName Cost IsDefault Order ReplaceUnitName ConcatenateWithUnitName OptionPicture }
      }
      squadMembers {
        Id DeathPriority ModelFileName
        primaryWeapon { Id Name HUDName Type HUDIcon }
        specialWeapon { Id Name HUDName Type HUDIcon }
      }
      availability {
        maxAvailability
        specialization { Id Name UIName Icon CountryId }
        transports { Id Name ThumbnailFileName }
      }
    }
  }
`;
