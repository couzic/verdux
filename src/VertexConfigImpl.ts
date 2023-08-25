import { Slice } from '@reduxjs/toolkit'
import { ReducerWithInitialState } from '@reduxjs/toolkit/dist/createReducer'
import { Reducer } from 'redux'
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
import { DependencyProviders } from './DependencyProviders'
import { PickedLoadedVertexState } from './PickedLoadedVertexState'
import { VertexConfig } from './VertexConfig'
import { VertexInternalState } from './VertexInternalState'
import { VertexRuntimeConfig } from './VertexRuntimeConfig'
import { VertexStateKey } from './VertexState'
import { VertexType } from './VertexType'
import { fromInternalState } from './fromInternalState'
import { pickInternalState } from './pickInternalState'
import { shallowEquals } from './shallowEquals'

export class VertexConfigImpl<Type extends VertexType>
   implements VertexConfig<Type>
{
   readonly id: symbol

   protected readonly internalStateTransformations: Array<
      (
         dependencies: Type['dependencies']
      ) => (
         internalState$: Observable<VertexInternalState<any>>
      ) => Observable<VertexInternalState<any>>
   > = []

   get rootVertex(): VertexConfig<any> {
      if (this.inputRootVertex === null) return this as any
      return this.inputRootVertex
   }

   constructor(
      public readonly name: string,
      public readonly getInitialState: () => Type['reduxState'],
      public readonly reducer: Reducer<Type['reduxState']>,
      public readonly upstreamVertex: VertexConfig<any> | undefined,
      public readonly upstreamFields: string[],
      private readonly inputRootVertex: VertexConfig<any> | null,
      public readonly dependencyProviders: DependencyProviders
   ) {
      this.id = Symbol(`Vertex ${name}`)
   }

   configureDownstreamVertex<
      ReduxState extends object,
      UpstreamField extends VertexStateKey<Type> = never
   >(
      options: (
         | {
              slice: Slice<ReduxState>
           }
         | {
              name: string
              reducer: ReducerWithInitialState<ReduxState>
           }
      ) & {
         upstreamFields?: UpstreamField[]
         dependencies?: DependencyProviders<Type>
      }
   ): any {
      const { name, getInitialState, reducer } =
         'slice' in options ? options.slice : { ...options, ...options.reducer }
      const upstreamFields: string[] =
         (options.upstreamFields as string[]) || []
      const downstreamConfig = new VertexConfigImpl(
         name,
         getInitialState,
         reducer as Reducer<any>,
         this as any,
         upstreamFields,
         this.rootVertex,
         options.dependencies || {}
      )
      return downstreamConfig
   }

   applyInternalStateTransformations(
      internalState$: Observable<VertexInternalState<any>>,
      dependencies: Type['dependencies']
   ) {
      return this.internalStateTransformations.reduce(
         (observable, transformation) =>
            transformation(dependencies)(observable),
         internalState$
      )
   }

   injectedWith(
      dependencies: Partial<Type['dependencies']>
   ): VertexRuntimeConfig<Type> {
      return {
         config: this,
         dependencies
      }
   }

   computeFromFields<
      K extends VertexStateKey<Type>,
      Computers extends Record<
         string,
         (
            pickedFields: {
               [PK in keyof PickedLoadedVertexState<
                  Type,
                  K
               >]: PickedLoadedVertexState<Type, K>[PK]
            },
            dependencies: Type['dependencies']
         ) => any
      >
   >(fields: K[], computers: Computers): any {
      this.internalStateTransformations.push(dependencies =>
         map(internalState => {
            // TODO make sure recomputing only occurs when picked fields change
            const picked = fromInternalState(
               pickInternalState(internalState, fields)
            )

            const computedValues: any = {}
            const computedFields = Object.keys(computers)
            computedFields.forEach(computedField => {
               computedValues[computedField] = computers[computedField](
                  picked as any,
                  dependencies
               ) // TODO catch errors ?
            })
            return {
               ...internalState,
               readonlyFields: {
                  ...internalState.readonlyFields,
                  ...computedValues
               } // TODO values computed from loadable fields go to loadable fields
            }
         })
      )
      return this
   }

   loadFromFields<K extends VertexStateKey<Type>, LoadableValues>(
      fields: K[],
      loaders: {
         [LVK in keyof LoadableValues]: (
            fields: {
               [FK in K]: FK extends keyof Type['loadableFields']
                  ? Type['loadableFields'][FK]
                  : FK extends keyof Type['readonlyFields']
                  ? Type['loadableFields'][FK]
                  : FK extends keyof Type['reduxState']
                  ? Type['reduxState'][FK]
                  : never
            },
            dependencies: Type['dependencies']
         ) => Observable<LoadableValues[LVK]>
      }
   ): any {
      this.internalStateTransformations.push(
         dependencies => inputInternalState$ => {
            const loadableKeys = Object.keys(
               loaders
            ) as (keyof LoadableValues)[]
            const loadingValues = {} as Record<keyof LoadableValues, any>
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
                     scan((acc, loadableValues) => {
                        return { ...acc, ...loadableValues } as any
                     }, loadingValues),
                     map(loadableFields => ({ internalState, loadableFields }))
                  )
               )
            )

            const internalStateWithChangedLoadableFields$ = merge(
               loading$,
               loadedOrError$
            ).pipe(share())

            const internalStateWithLatestLoadableFields$ =
               pickedNotChanged$.pipe(
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
      )
      return this
   }
}
