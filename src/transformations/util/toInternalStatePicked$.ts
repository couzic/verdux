import { Observable, map, scan, share } from 'rxjs'
import { VertexInternalState } from '../../VertexInternalState'
import { fromInternalState } from '../../fromInternalState'
import { internalStateEquals } from '../../internalStateEquals'
import { pickInternalState } from '../../pickInternalState'

export const toInternalStatePicked$ = (
   inputInternalState$: Observable<VertexInternalState<any>>,
   fields: string[]
) =>
   inputInternalState$.pipe(
      map(inputInternalState => {
         const pickedInternalState = pickInternalState(
            inputInternalState,
            fields
         )
         const pickedState = fromInternalState(pickedInternalState)
         return {
            inputInternalState,
            pickedInternalState,
            pickedState,
            pickedStateHasChanged: true
         }
      }),
      scan(
         (
            previous,
            { inputInternalState, pickedInternalState, pickedState }
         ) => ({
            inputInternalState,
            pickedInternalState,
            pickedState,
            pickedStateHasChanged: !internalStateEquals(
               previous.pickedInternalState,
               pickedInternalState
            )
         })
      ),
      share()
   )
