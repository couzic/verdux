import { VertexInternalState } from '../state/VertexInternalState'

export const mergeVersions = (internalStates: VertexInternalState<any>[]) => {
   const versions = {} as Record<symbol, number>
   let versionsConverged = true
   internalStates.forEach(internalState => {
      // TODO break iteration if diverged
      const vertexIds = Object.getOwnPropertySymbols(internalState.versions)
      vertexIds.forEach(vertexId => {
         // TODO break iteration if diverged
         const version = internalState.versions[vertexId]
         if (versions[vertexId] === undefined) {
            versions[vertexId] = version
         }
         if (versions[vertexId] !== version) {
            versionsConverged = false
            versions[vertexId] = null as any
         }
      })
   })
   return { internalStates, versions, versionsConverged }
}
