export const SEARCH_UNITS_QUERY = `
  query SearchUnits($search: String!, $limit: Int) {
    searchUnits(search: $search, limit: $limit) {
      Id
      HUDName
      ThumbnailFileName
      CountryId
      CategoryType
      Cost
    }
  }
`;
