export const ARSENAL_PAGE_QUERY = `
  query ArsenalPageData {
    arsenalUnitsCards {
      unit {
        Id
        Name
        HUDName
        CountryId
        CategoryType
        Cost
        ThumbnailFileName
        PortraitFileName
        IsUnitModification
        DisplayInArmory
      }
      displayName
      isTransport
      specializationIds
      transportCapacity
      cargoCapacity
      availableTransports
      defaultModificationOptions {
        optCost
      }
      rootUnitId
      rootOptionId
    }
    countries {
      Id
      Name
      FlagFileName
    }
    specializations {
      Id
      CountryId
      UIName
      UIDescription
      Icon
    }
  }
`;
