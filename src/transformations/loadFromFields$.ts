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
   withLatestFrom
} from 'rxjs'
import { Dependable } from '../config/Dependable'
import { VertexInternalState } from '../state/VertexInternalState'
import { toInternalStatePicked$ } from '../util/toInternalStatePicked$'

// TODO Remove duplication with "loadFromFields()"

export const loadFromFieldsStreamTransformation =
   (
      fields: string[],
      loaders: Dependable<
         any,
         Record<string, (fields$: Observable<any>) => Observable<any>>
      >
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

         const pickedNotChanged$ = internalStatePicked$.pipe(
            filter(({ pickedStateHasChanged }) => !pickedStateHasChanged)
         )

         const pickedChanged$ = internalStatePicked$.pipe(
            filter(({ pickedStateHasChanged }) => pickedStateHasChanged)
         )

         const loading$ = pickedChanged$.pipe(map(() => loadingValues))

         const changedFields$ = pickedChanged$.pipe(
            filter(
               // All picked loadable fields are loaded
               ({ pickedInternalState: { loadableFields } }) => {
                  for (let key in loadableFields) {
                     if (loadableFields[key].status !== 'loaded') return false
                  }
                  return true
               }
            ),
            map(_ => _.pickedState)
         )

         const loadedOrError$ = merge(
            ...loadableKeys.map(key =>
               injectedLoaders[key](changedFields$).pipe(
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
            }, loadingValues)
         )

         const loadable$ = merge(loading$, loadedOrError$).pipe(share())

         const internalStateWithLoadableFieldsWhenPickedFieldsChange$ =
            loadable$.pipe(
               withLatestFrom(
                  inputInternalState$,
                  (loadableFields, internalState) => ({
                     internalState,
                     loadableFields
                  })
               )
            )

         const internalStateWithLoadableFieldsWhenPickedFieldsDidNotChange$ =
            pickedNotChanged$.pipe(
               map(_ => _.inputInternalState),
               withLatestFrom(
                  loadable$.pipe(startWith(loadingValues)),
                  (internalState, loadableFields) => ({
                     internalState,
                     loadableFields
                  })
               )
            )

         return merge(
            internalStateWithLoadableFieldsWhenPickedFieldsChange$,
            internalStateWithLoadableFieldsWhenPickedFieldsDidNotChange$
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
