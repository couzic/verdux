import { AnyAction, combineReducers, configureStore } from '@reduxjs/toolkit'
import { Reducer } from 'redux'
import { combineEpics, createEpicMiddleware, ofType } from 'redux-observable'
import {
   Observable,
   ReplaySubject,
   Subject,
   distinctUntilChanged,
   filter,
   map,
   skip
} from 'rxjs'
import { Graph } from './Graph'
import { VertexConfig } from './VertexConfig'
import { VertexConfigImpl } from './VertexConfigImpl'
import { VertexInstance } from './VertexInstance'
import { VertexInternalState } from './VertexInternalState'
import { VertexLoadableState } from './VertexLoadableState'
import { VertexRuntimeConfig } from './VertexRuntimeConfig'
import { VertexState } from './VertexState'
import { VertexType } from './VertexType'
import { fromLoadableState } from './fromLoadableState'
import { internalStateEquals } from './internalStateEquals'
import { loadableFromInternalState } from './loadableFromInternalState'
import { pickInternalState } from './pickInternalState'
import { pickLoadableState } from './pickLoadableState'

export const createGraph = (options: {
   vertices: Array<VertexRuntimeConfig<any>>
}) => {
   const runtimeConfigs = options.vertices
   if (runtimeConfigs.length === 0)
      throw new Error('createGraph() does not accept an empty vertices array')

   const uniqueVertexIds: symbol[] = []
   const vertexConfigById: Record<symbol, VertexConfig<any>> = {}
   const injectedDependenciesByVertexId: Record<symbol, any> = {}

   const indexById = (runtimeConfig: VertexRuntimeConfig<any>) => {
      const injectedDependencies =
         'config' in runtimeConfig ? runtimeConfig.injectedDependencies : null
      const config =
         'config' in runtimeConfig ? runtimeConfig.config : runtimeConfig
      const upstreamConfig = config.upstreamVertex
      if (upstreamConfig) {
         indexById(upstreamConfig)
      }
      if (!vertexConfigById[config.id]) {
         uniqueVertexIds.push(config.id)
         vertexConfigById[config.id] = config
         if (injectedDependencies) {
            injectedDependenciesByVertexId[config.id] = injectedDependencies
         }
      }
   }
   runtimeConfigs.forEach(indexById)

   const uniqueVertexConfigs = uniqueVertexIds.map(id => vertexConfigById[id])

   const vertexConfigsByUpstreamId: Record<
      symbol,
      Array<VertexConfig<any>>
   > = {}

   uniqueVertexConfigs.forEach(config => {
      const upstreamConfig = config.upstreamVertex
      if (upstreamConfig !== undefined) {
         if (!vertexConfigsByUpstreamId[upstreamConfig.id]) {
            vertexConfigsByUpstreamId[upstreamConfig.id] = []
         }
         vertexConfigsByUpstreamId[upstreamConfig.id].push(config)
      }
   })

   // TODO Make sure all upstream vertex configs are indexed by ID, even if they were not explicitely passed to the vertices array in options
   // TODO print warning if upstream vertex is not passed in vertices array

   const rootVertexConfig: VertexConfigImpl<any> = uniqueVertexConfigs[0]
      .rootVertex as any
   uniqueVertexConfigs.forEach(config => {
      if (config.rootVertex.id !== rootVertexConfig.id) {
         throw new Error(
            `Error creating graph: impossible to create graph with multiple root vertices ("${config.id.description}" has root "${config.rootVertex.id.description}" but another root "${rootVertexConfig.id.description}" exists)`
         )
      }
   })

   const createReduxReducer = (
      vertexConfig: VertexConfig<any>
   ): Reducer<any> => {
      const downstreamVertexConfigs =
         vertexConfigsByUpstreamId[vertexConfig.id] || []
      if (downstreamVertexConfigs.length === 0)
         return combineReducers({ vertex: vertexConfig.reducer })

      const downstreamReducersByName = {} as Record<string, Reducer<any>>
      downstreamVertexConfigs.forEach(config => {
         downstreamReducersByName[config.name] = createReduxReducer(config)
      })
      return combineReducers({
         vertex: vertexConfig.reducer,
         downstream: combineReducers(downstreamReducersByName)
      })
   }

   const rootReducer = createReduxReducer(rootVertexConfig)

   const epicMiddleware = createEpicMiddleware()

   const reduxStore = configureStore({
      reducer: rootReducer,
      middleware: getDefaultMiddleware =>
         getDefaultMiddleware().concat(epicMiddleware) // TODO Remove thunk ?
   })

   const epics = [] as any[]

   const dispatch = (action: AnyAction) => reduxStore.dispatch(action)

   const createVertexInstance = <Type extends VertexType>(
      config: VertexConfig<Type>,
      internalState$: Observable<VertexInternalState<Type>>,
      dependencies: Type['dependencies']
   ): VertexInstance<Type> => {
      let currentState: VertexState<Type>
      let loadableState$ = new ReplaySubject<VertexLoadableState<Type>>(1) // TODO use some kind of StateObservable ?
      const state$ = loadableState$.pipe(map(_ => _.state)) // TODO use some kind of StateObservable ?
      let currentLoadableState: VertexLoadableState<Type> = null as any
      internalState$
         .pipe(map(loadableFromInternalState))
         .subscribe(loadableState => {
            currentLoadableState = loadableState
            currentState = loadableState.state
            loadableState$.next(loadableState)
         })

      ///////////////////////
      // fieldsReaction() //
      /////////////////////
      ;(config as VertexConfigImpl<Type>).fieldsReactions.forEach(reaction => {
         internalState$
            .pipe(
               map(internalState =>
                  pickInternalState(internalState, reaction.fields)
               ),
               distinctUntilChanged(internalStateEquals),
               skip(1),
               map(loadableFromInternalState),
               filter(_ => _.status === 'loaded')
            )
            .subscribe(pickedLoadableState => {
               const fields = fromLoadableState(pickedLoadableState)
               const action = reaction.operation(fields)
               graph.dispatch(action)
            })
      })

      const vertex: VertexInstance<Type> = {
         get id() {
            return config.id
         },
         get name() {
            return config.name
         },
         get currentState() {
            return currentState
         },
         get state$() {
            return state$
         },
         get currentLoadableState() {
            return currentLoadableState
         },
         get loadableState$() {
            return loadableState$
         },
         get dependencies() {
            return dependencies
         },
         pick: fields =>
            loadableState$.pipe(
               map(loadableState => pickLoadableState(loadableState, fields))
            )
      }

      /////////////////
      // reaction() //
      ///////////////
      ;(config as VertexConfigImpl<Type>).reactions.forEach(reaction => {
         const epic = (action$: Observable<AnyAction>) =>
            reaction.operation(
               action$.pipe(ofType(reaction.actionCreator.type)),
               vertex
            )
         epics.push(epic)
      })

      return vertex
   }

   const buildVertexDependencies = (
      config: VertexConfig<any>,
      upstreamDependencies: any
   ) => {
      const providers = config.dependencyProviders
      const dependencyNames = Object.keys(providers)
      const injectedDependencies =
         injectedDependenciesByVertexId[config.id] || {}
      const dependencies = { ...upstreamDependencies }
      dependencyNames.forEach(depName => {
         const injectedDep = injectedDependencies[depName]
         if (injectedDep) {
            dependencies[depName] = injectedDep
         } else {
            dependencies[depName] = providers[depName](dependencies)
         }
      })
      return dependencies
   }

   const rootDependencies = buildVertexDependencies(rootVertexConfig, {})

   const reduxState$ = new Subject<any>()

   const originalRootInternalState$ = reduxState$.pipe(
      map(
         (reduxState): VertexInternalState<any> => ({
            reduxState,
            readonlyFields: {},
            loadableFields: {}
         })
      )
   )
   const rootInternalState$ =
      rootVertexConfig.applyInternalStateTransformations(
         originalRootInternalState$,
         rootDependencies
      )

   const rootVertexInstance = createVertexInstance(
      rootVertexConfig,
      rootInternalState$,
      rootDependencies
   )

   const vertexById: Record<
      symbol,
      {
         instance: VertexInstance<any>
         internalState$: Observable<VertexInternalState<any>>
      }
   > = {
      [rootVertexConfig.id]: {
         instance: rootVertexInstance,
         internalState$: rootInternalState$
      }
   }

   const createInternalStateStream = (
      config: VertexConfigImpl<any>,
      upstreamInternalState$: Observable<VertexInternalState<any>>,
      dependencies: any
   ) => {
      const originalInternalState$ = upstreamInternalState$.pipe(
         map((upstream): VertexInternalState<any> => {
            const reduxState = upstream.reduxState.downstream[config.name]
            const readonlyFields: any = {}
            const loadableFields: any = {}
            config.upstreamFields.forEach(field => {
               // TODO Define priorities between reduxState, readonlyFields and loadableFields
               // TODO Print warning / throw Error when field on more than one of upstream reduxState/readonlyFields/loadableFields
               if (field in upstream.reduxState.vertex) {
                  readonlyFields[field] = upstream.reduxState.vertex[field]
               } else if (field in upstream.readonlyFields) {
                  readonlyFields[field] = upstream.readonlyFields[field]
               } else if (field in upstream.loadableFields) {
                  loadableFields[field] = upstream.loadableFields[field]
               }
            })
            return {
               reduxState,
               readonlyFields,
               loadableFields
            }
         })
      )
      return config.applyInternalStateTransformations(
         originalInternalState$,
         dependencies
      )
   }

   const createVertex = <Type extends VertexType>(
      config: VertexConfig<Type>
   ): void => {
      if (vertexById[config.id]) return
      const upstreamVertexConfig = config.upstreamVertex!
      if (vertexById[upstreamVertexConfig.id] === undefined) {
         createVertex(upstreamVertexConfig)
      }

      const upstreamVertex = vertexById[upstreamVertexConfig.id]
      const dependencies = buildVertexDependencies(
         config,
         upstreamVertex.instance.dependencies
      )

      const internalState$: Observable<VertexInternalState<Type>> =
         createInternalStateStream(
            config as any,
            upstreamVertex.internalState$,
            dependencies
         ) as any
      const instance = createVertexInstance(
         config,
         internalState$,
         dependencies
      )
      vertexById[config.id] = { instance, internalState$ }
   }

   uniqueVertexConfigs.forEach(createVertex)

   reduxState$.next(reduxStore.getState())
   reduxStore.subscribe(() => reduxState$.next(reduxStore.getState()))

   const graph: Graph = {
      getVertexInstance: config => vertexById[config.id].instance,
      dispatch
   }

   epicMiddleware.run(combineEpics(...epics))

   return graph
}
