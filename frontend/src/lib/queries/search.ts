export const SEARCH_UNITS_QUERY = `
  query SearchUnits($search: String!, $limit: Int) {
    searchUnits(search: $search, limit: $limit) {
      Id
      HUDName
      displayName
      ThumbnailFileName
      CountryId
      CategoryType
      Cost
      rootUnitId
      rootOptionId
    }
  }
`;
