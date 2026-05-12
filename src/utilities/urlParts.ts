type UrlQueryParts = {
  path: string
  query: string
}

type UrlHashParts = {
  pathAndQuery: string
  hash: string
}

type RelativeHrefParts = {
  pathname: string
  query: string
  hash: string
}

export function splitUrlQuery(value: string): UrlQueryParts {
  const queryIndex = value.indexOf('?')

  if (queryIndex < 0) {
    return {
      path: value,
      query: '',
    }
  }

  return {
    path: value.slice(0, queryIndex),
    query: value.slice(queryIndex + 1),
  }
}

function splitUrlHash(value: string): UrlHashParts {
  const hashIndex = value.indexOf('#')

  if (hashIndex < 0) {
    return {
      pathAndQuery: value,
      hash: '',
    }
  }

  return {
    pathAndQuery: value.slice(0, hashIndex),
    hash: value.slice(hashIndex + 1),
  }
}

export function splitRelativeHrefParts(href: string): RelativeHrefParts {
  const { pathAndQuery, hash } = splitUrlHash(href)
  const { path, query } = splitUrlQuery(pathAndQuery)

  return {
    pathname: path.length > 0 ? path : '/',
    query,
    hash,
  }
}
