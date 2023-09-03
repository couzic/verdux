import {
   Observable,
   catchError,
   filter,
   map,
   merge,
   mergeAll,
   of,
   scan,
   share,
   startWith,
   switchMap,
   withLatestFrom
} from 'rxjs'
import { VertexInternalState } from '../VertexInternalState'
import { fromInternalState } from '../fromInternalState'
import { pickInternalState } from '../pickInternalState'
import { shallowEquals } from '../shallowEquals'

// TODO Remove duplication with "load()"

export const loadFromFieldsTransformation =
   (fields: string[], loaders: any) =>
   (dependencies: any) =>
   (inputInternalState$: Observable<VertexInternalState<any>>): any => {
      const loadableKeys = Object.keys(loaders)
      const loadingValues = {} as Record<string, any>
      loadableKeys.forEach(key => {
         loadingValues[key] = {
            status: 'loading',
            error: undefined,
            value: undefined
         }
      })

      const internalStatePicked$ = inputInternalState$.pipe(
         // TODO this logs too many identical internal states, investigate
         // tap(console.log),
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
         }))
      )

      const pickedNotChanged$ = internalStatePicked$.pipe(
         filter(({ pickedStateHasChanged }) => !pickedStateHasChanged)
      )

      const pickedChanged$ = internalStatePicked$.pipe(
         filter(({ pickedStateHasChanged }) => pickedStateHasChanged)
      )

      const loading$ = pickedChanged$.pipe(
         map(({ internalState }) => ({
            internalState,
            loadableFields: loadingValues
         }))
      )

      const loadedOrError$ = pickedChanged$.pipe(
         switchMap(({ internalState, pickedState }) =>
            merge(
               loadableKeys.map(key =>
                  loaders[key](pickedState as any, dependencies).pipe(
                     map(result => ({
                        [key]: {
                           status: 'loaded',
                           value: result,
                           error: undefined
                        }
                     })),
                     catchError((error: Error) =>
                        of({
                           [key]: {
                              status: 'error',
                              value: undefined,
                              error
                           }
                        })
                     ) // TODO Recover from Error
                  )
               )
            ).pipe(
               mergeAll(),
               scan((acc, loadableValues: any) => {
                  return { ...acc, ...loadableValues }
               }, loadingValues),
               map(loadableFields => ({ internalState, loadableFields }))
            )
         )
      )

      const internalStateWithChangedLoadableFields$ = merge(
         loading$,
         loadedOrError$
      ).pipe(share())

      const internalStateWithLatestLoadableFields$ = pickedNotChanged$.pipe(
         withLatestFrom(
            internalStateWithChangedLoadableFields$.pipe(
               startWith({ loadableFields: loadingValues })
            )
         ),
         map(([{ internalState }, { loadableFields }]) => ({
            internalState,
            loadableFields
         }))
      )

      return merge(
         internalStateWithChangedLoadableFields$,
         internalStateWithLatestLoadableFields$
      ).pipe(
         map(({ internalState, loadableFields }) => ({
            ...internalState,
            loadableFields: {
               ...internalState.loadableFields,
               ...loadableFields
            }
         }))
      )
   }
