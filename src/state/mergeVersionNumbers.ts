export const mergeVersionNumbers = (
   previous: Record<symbol, number>,
   next: Record<symbol, number>
) => {
   const versions = {} as Record<symbol, number>
   Object.getOwnPropertySymbols(previous || {}).forEach(vertexId => {
      versions[vertexId] = previous[vertexId]
   })
   Object.getOwnPropertySymbols(next || {}).forEach(vertexId => {
      const previousVersion = versions[vertexId]
      const nextVersion = next[vertexId]
      if (previousVersion === undefined) {
         versions[vertexId] = nextVersion
      } else {
         versions[vertexId] = Math.max(previousVersion, nextVersion)
      }
   })
   return versions
}
