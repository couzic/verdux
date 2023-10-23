import { Observable, combineLatest, filter, map } from 'rxjs'
import { pickInternalState } from '../util/pickInternalState'
import { VertexInternalState } from './VertexInternalState'
import { VertexStateKey } from './VertexState'
import { mergeVersions } from './mergeVersions'

export const incomingFromMultipleUpstreamInternalStates = (
   vertexName: string,
   lastCommonAncestorInternalState$: Observable<VertexInternalState<any>>,
   directAncestors: Array<{
      internalState$: Observable<VertexInternalState<any>>
      pickedFields: VertexStateKey<any>[]
   }>
): Observable<VertexInternalState<any>> => {
   const directAncestorsPickedInternalStateStreams = directAncestors.map(
      ({ internalState$, pickedFields }) =>
         internalState$.pipe(
            map(internalState => pickInternalState(internalState, pickedFields))
         )
   )

   return combineLatest([
      lastCommonAncestorInternalState$,
      ...directAncestorsPickedInternalStateStreams
   ]).pipe(
      map(mergeVersions),
      filter(({ versionsConverged }) => versionsConverged),
      map(({ internalStates, versions }) => {
         const [
            internalStateFromCommonAncestor,
            ...internalStatesFromDirectAncestors
         ] = internalStates
         const reduxState =
            internalStateFromCommonAncestor.reduxState.downstream[vertexName]
         const readonlyFields: any = {}
         const loadableFields: any = {}
         internalStatesFromDirectAncestors.forEach(internalState => {
            // TODO Warn if clash
            Object.assign(readonlyFields, internalState.reduxState.vertex)
            Object.assign(readonlyFields, internalState.readonlyFields)
            Object.assign(loadableFields, internalState.loadableFields)
         })
         return {
            versions,
            reduxState,
            readonlyFields,
            loadableFields
         }
      })
   )
}
