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
        IsUnitModification
        DisplayInArmory
      }
      isTransport
      specializationIds
      transportCapacity
      cargoCapacity
      availableTransports
      defaultModificationOptions {
        optCost
      }
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
