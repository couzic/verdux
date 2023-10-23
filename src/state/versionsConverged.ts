import { VertexInternalState } from './VertexInternalState'

export const versionsConverged = (
   internalStates: VertexInternalState<any>[]
) => {
   const versions = {} as Record<symbol, number>
   for (const internalStateIndex in internalStates) {
      const internalState = internalStates[internalStateIndex]
      const vertexIds = Object.getOwnPropertySymbols(internalState.versions)
      for (const vertexIndex in vertexIds) {
         const vertexId = vertexIds[vertexIndex]
         const version = internalState.versions[vertexId]
         if (versions[vertexId] === undefined) {
            versions[vertexId] = version
         }
         if (versions[vertexId] !== version) {
            return false
         }
      }
   }
   return true
}
