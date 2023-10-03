import {
   Observable,
   catchError,
   combineLatest,
   distinctUntilChanged,
   map,
   merge,
   of,
   scan,
   shareReplay,
   startWith,
   switchMap
} from 'rxjs'
import { Dependable } from '../config/Dependable'
import { VertexInternalState } from '../state/VertexInternalState'

// TODO Remove duplication with "loadFromFields$()"

export const loadFromStreamTransformation =
   <Input>(
      input$: Dependable<any, Observable<Input>>,
      loaders: Dependable<
         any,
         Record<string, (input: Input) => Observable<any>>
      >
   ) =>
   (dependencies: any) => {
      const injectedInput$ = (
         typeof input$ === 'function' ? input$(dependencies) : input$
      ).pipe(shareReplay(1))
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

         const loading$ = injectedInput$.pipe(
            map(() => loadingValues),
            startWith(loadingValues)
         )

         const loadedOrError$ = injectedInput$.pipe(
            switchMap(input =>
               merge(
                  ...loadableKeys.map(key =>
                     injectedLoaders[key](input).pipe(
                        map(value => ({
                           [key]: {
                              status: 'loaded',
                              error: undefined,
                              value
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
               )
            ),
            scan(
               (acc, loadableValues) => ({ ...acc, ...loadableValues }),
               loadingValues
            )
         )

         const loadable$ = merge(loading$, loadedOrError$).pipe(
            distinctUntilChanged()
         )

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
