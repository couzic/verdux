import { Observable, filter, map, merge, scan, share } from 'rxjs'
import { InjectedTransformation } from '../transformations/InternalStateTransformation'
import { internalStateEquals } from '../util/internalStateEquals'
import { VertexInternalState } from './VertexInternalState'

export interface MemoizableInternalState {
   fromMemory: boolean
   internalState: VertexInternalState<any>
}
const INITIAL_VALUE = Symbol(
   'INCOMING_TO_OUTGOING_INTERNAL_STATE_STREAM_INITIAL_VALUE'
) as any as MemoizableInternalState

export function incomingToOutgoingInternalStateStream(
   vertexId: symbol,
   incomingInternalState$: Observable<VertexInternalState<any>>,
   internalStateTransformations: InjectedTransformation[]
): Observable<VertexInternalState<any>> {
   const memoizable$ = incomingInternalState$.pipe(
      scan(
         (previous, next) => ({
            fromMemory:
               previous !== INITIAL_VALUE &&
               internalStateEquals(previous.internalState, next),
            internalState: next
         }),
         INITIAL_VALUE
      ),
      share()
   )

   const fromMemory$ = memoizable$.pipe(filter(_ => _.fromMemory))

   const notFromMemory$ = memoizable$.pipe(filter(_ => !_.fromMemory))

   const transformed$ = notFromMemory$.pipe(
      map(_ => _.internalState),
      ...(internalStateTransformations as [InjectedTransformation]),
      map(internalState => ({ fromMemory: false, internalState }))
   )

   return merge(fromMemory$, transformed$).pipe(
      scan(
         (previous, next): VertexInternalState<any> => {
            const versions = {
               ...next.internalState.versions,
               [vertexId]:
                  previous.versions[vertexId] + (next.fromMemory ? 0 : 1)
            }
            if (next.fromMemory) {
               return {
                  versions,
                  reduxState: next.internalState.reduxState,
                  readonlyFields: {
                     // TODO !!! CLASH DANGER !!!
                     ...previous.readonlyFields, // previous transformation output
                     ...next.internalState.readonlyFields
                  },
                  loadableFields: {
                     // TODO !!! CLASH DANGER !!!
                     ...previous.loadableFields, // previous transformation output
                     ...next.internalState.loadableFields
                  }
               }
            } else {
               return {
                  ...next.internalState,
                  versions
               }
            }
         },
         { versions: { [vertexId]: 0 } } as VertexInternalState<any>
      )
   )
}
