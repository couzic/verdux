import {
   Observable,
   catchError,
   filter,
   map,
   merge,
   of,
   scan,
   share,
   switchMap,
   tap,
   withLatestFrom
} from 'rxjs'
import { Dependable } from '../config/Dependable'
import { VertexInternalState } from '../state/VertexInternalState'
import { toInternalStatePicked$ } from '../util/toInternalStatePicked$'

export const loadFromFieldsTransformation =
   (
      fields: string[],
      loaders: Dependable<any, Record<string, (fields: any) => Observable<any>>>
   ) =>
   (dependencies: any) => {
      const injectedLoaders =
         typeof loaders === 'function' ? loaders(dependencies) : loaders
      return (internalState$: Observable<VertexInternalState<any>>): any => {
         const inputInternalState$ = internalState$.pipe(share())
         const loadableKeys = Object.keys(injectedLoaders)
         const loadingValues = {} as Record<string, any>
         loadableKeys.forEach(key => {
            loadingValues[key] = {
               status: 'loading',
               error: undefined,
               value: undefined
            }
         })

         const internalStatePicked$ = toInternalStatePicked$(
            inputInternalState$,
            fields
         )

         const pickedChanged$ = internalStatePicked$.pipe(
            filter(({ pickedStateHasChanged }) => pickedStateHasChanged)
         )

         const loading$ = pickedChanged$.pipe(map(() => loadingValues))

         const loadedOrError$ = pickedChanged$.pipe(
            filter(
               // All picked loadable fields are loaded
               ({ pickedInternalState: { loadableFields } }) => {
                  for (let key in loadableFields) {
                     if (loadableFields[key].status !== 'loaded') return false
                  }
                  return true
               }
            ),
            switchMap(({ pickedState }) =>
               merge(
                  ...loadableKeys.map(key =>
                     injectedLoaders[key](pickedState as any).pipe(
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
                  scan(
                     (acc, loadableValues: any) => ({
                        ...acc,
                        ...loadableValues
                     }),
                     loadingValues
                  )
               )
            )
         )

         let latestLoadableFields = loadingValues
         const loadableFields$ = merge(loading$, loadedOrError$).pipe(
            tap(loadableFields => (latestLoadableFields = loadableFields))
         )
         const loadableFieldsWithLatestInternalState$ = loadableFields$.pipe(
            withLatestFrom(inputInternalState$),
            map(([loadableFields, inputInternalState]) => ({
               loadableFields,
               inputInternalState
            }))
         )

         const internalStateWithLatestLoadableFields$ =
            internalStatePicked$.pipe(
               filter(({ pickedStateHasChanged }) => !pickedStateHasChanged),
               map(({ inputInternalState }) => ({
                  inputInternalState,
                  loadableFields: latestLoadableFields
               }))
            )

         return merge(
            loadableFieldsWithLatestInternalState$,
            internalStateWithLatestLoadableFields$
         ).pipe(
            map(({ inputInternalState, loadableFields }) => ({
               ...inputInternalState,
               loadableFields: {
                  ...inputInternalState.loadableFields,
                  ...loadableFields
               }
            }))
         )
      }
   }
