import { Observable, map } from 'rxjs'
import { VertexInternalState } from '../state/VertexInternalState'
import { pickInternalState } from '../util/pickInternalState'

export const incomingFromSingleUpstreamInternalState = (
   vertexName: string,
   pickedFields: string[],
   upstreamInternalState$: Observable<VertexInternalState<any>>
): Observable<VertexInternalState<any>> =>
   upstreamInternalState$.pipe(
      map(internalState => pickInternalState(internalState, pickedFields)),
      map(_ => ({
         versions: _.versions,
         reduxState: _.reduxState.downstream[vertexName],
         readonlyFields: { ..._.reduxState.vertex, ..._.readonlyFields }, // TODO Warn if clash
         loadableFields: _.loadableFields
      }))
   )
