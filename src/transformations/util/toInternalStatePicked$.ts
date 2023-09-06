import { Observable, map, scan, share } from 'rxjs'
import { VertexInternalState } from '../../VertexInternalState'
import { fromInternalState } from '../../fromInternalState'
import { pickInternalState } from '../../pickInternalState'
import { shallowEquals } from '../../shallowEquals'

export const toInternalStatePicked$ = (
   internalState$: Observable<VertexInternalState<any>>,
   fields: string[]
) =>
   internalState$.pipe(
      map(internalState => {
         const pickedState = fromInternalState(
            pickInternalState(internalState, fields)
         )
         return {
            internalState,
            pickedState,
            pickedStateHasChanged: true
         }
      }),
      scan((previous, { internalState, pickedState }) => ({
         internalState,
         pickedState,
         pickedStateHasChanged: !shallowEquals(
            previous.pickedState,
            pickedState
         )
      })),
      share()
   )
