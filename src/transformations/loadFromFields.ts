import {
   Observable,
   catchError,
   filter,
   map,
   merge,
   of,
   scan,
   share,
   startWith,
   switchMap,
   withLatestFrom
} from 'rxjs'
import { Dependable } from '../Dependable'
import { VertexInternalState } from '../VertexInternalState'
import { toInternalStatePicked$ } from './util/toInternalStatePicked$'

// TODO Remove duplication with "load()"

export const loadFromFieldsTransformation =
   (
      fields: string[],
      loaders: Dependable<any, Record<string, (fields: any) => Observable<any>>>
   ) =>
   (dependencies: any) => {
      const injectedLoaders =
         typeof loaders === 'function' ? loaders(dependencies) : loaders
      return (
         inputInternalState$: Observable<VertexInternalState<any>>
      ): any => {
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
   }
