import { Observable, filter, map, merge, scan, share } from 'rxjs'
import { InjectedTransformation } from '../transformations/InternalStateTransformation'
import { internalStateEquals } from '../util/internalStateEquals'
import { VertexInternalState } from './VertexInternalState'
import { mergeVersionNumbers } from './mergeVersionNumbers'

export interface MemoizableInternalState {
   fromMemory: boolean
   internalState: VertexInternalState<any>
}
const INITIAL_VALUE = Symbol(
   'INCOMING_TO_OUTGOING_INTERNAL_STATE_STREAM_INITIAL_VALUE'
) as any as MemoizableInternalState

export function incomingToOutgoingInternalStateStream(
   vertexId: symbol,
   incomingInternalState$: Observable<VertexInternalState<any>>, // TODO share()
   internalStateTransformations: InjectedTransformation[]
): Observable<VertexInternalState<any>> {
   const memoizable$ = incomingInternalState$.pipe(
      scan((previous, next) => {
         if (previous === INITIAL_VALUE) {
            return {
               fromMemory: false,
               internalState: next
            }
         } else {
            return {
               fromMemory: internalStateEquals(previous.internalState, next),
               internalState: next
            }
         }
      }, INITIAL_VALUE),
      share()
   )

   const fromMemory$ = memoizable$.pipe(filter(_ => _.fromMemory))

   const notFromMemory$ = memoizable$.pipe(filter(_ => !_.fromMemory))

   const transformed$ = notFromMemory$.pipe(
      map(_ => _.internalState),
      ...(internalStateTransformations as [InjectedTransformation]),
      map(internalState => ({ fromMemory: false, internalState }))
   )

   const outgoing$ = merge(fromMemory$, transformed$).pipe(
      scan(
         (previous, next): VertexInternalState<any> => {
            const mergedVersions = mergeVersionNumbers(
               previous.versions,
               next.internalState.versions
            )
            if (next.fromMemory) {
               return {
                  ...previous,
                  versions: mergedVersions
               }
            } else {
               return {
                  ...next.internalState,
                  versions: {
                     ...mergedVersions,
                     [vertexId]: 1 + previous.versions[vertexId]
                  }
               }
            }
         },
         { versions: { [vertexId]: 0 } } as VertexInternalState<any>
      )
   )

   return outgoing$
}
