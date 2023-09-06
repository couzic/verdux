import {
   Observable,
   catchError,
   combineLatest,
   map,
   merge,
   of,
   scan
} from 'rxjs'
import { Dependable } from '../Dependable'
import { VertexInternalState } from '../VertexInternalState'

// TODO Remove duplication with "loadFromFields()"

export const loadTransformation =
   (loaders: Dependable<any, Record<string, Observable<any>>>) =>
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

         const loading$ = of(loadingValues)

         const loadedOrError$ = merge(
            ...loadableKeys.map(key =>
               injectedLoaders[key].pipe(
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

         const loadable$ = merge(loading$, loadedOrError$)

         return combineLatest([inputInternalState$, loadable$]).pipe(
            map(([internalState, loadableFields]) => ({
               ...internalState,
               loadableFields: {
                  ...internalState.loadableFields,
                  ...loadableFields
               }
            }))
         )
      }
   }
