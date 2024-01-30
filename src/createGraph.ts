import {
   UnknownAction,
   combineReducers,
   configureStore
} from '@reduxjs/toolkit'
import { Reducer } from 'redux'
import { combineEpics, createEpicMiddleware, ofType } from 'redux-observable'
import {
   NEVER,
   Observable,
   ReplaySubject,
   Subject,
   distinctUntilChanged,
   filter,
   map,
   mergeMap,
   skip
} from 'rxjs'
import { Graph } from './Graph'
import { VertexInstance } from './VertexInstance'
import { VertexType } from './VertexType'
import { VertexConfig } from './config/VertexConfig'
import { VertexConfigImpl } from './config/VertexConfigImpl'
import { VertexRuntimeConfig } from './config/VertexRuntimeConfig'
import { VertexInternalState } from './state/VertexInternalState'
import { VertexLoadableState } from './state/VertexLoadableState'
import { VertexState } from './state/VertexState'
import { fromLoadableState } from './util/fromLoadableState'
import { internalStateEquals } from './util/internalStateEquals'
import { loadableFromInternalState } from './util/loadableFromInternalState'
import { loadableStateEquals } from './util/loadableStateEquals'
import { pickInternalState } from './util/pickInternalState'
import { pickLoadableState } from './util/pickLoadableState'

export const createGraph = (options: {
   vertices: Array<VertexRuntimeConfig<any>>
   devtools?: (params: any) => void
}) => {
   const runtimeConfigs = options.vertices
   if (runtimeConfigs.length === 0)
      throw new Error('createGraph() does not accept an empty vertices array')

   //////////////////////////////////////////////////////////////////
   // Index vertex configs and injected dependencies by vertex id //
   // Ensure no config is missing in graph ////////////////////////
   ///////////////////////////////////////////////////////////////

   const exhaustiveVertexIds: symbol[] = []
   const vertexConfigById: Record<symbol, VertexConfig<any>> = {}
   const injectedDependenciesByVertexId: Record<symbol, any> = {}

   const indexById = (runtimeConfig: VertexRuntimeConfig<any>) => {
      const config =
         'config' in runtimeConfig ? runtimeConfig.config : runtimeConfig
      if (vertexConfigById[config.id]) return
      const injectedDependencies =
         'config' in runtimeConfig ? runtimeConfig.injectedDependencies : null
      config.upstreamVertices.forEach(indexById)
      exhaustiveVertexIds.push(config.id)
      vertexConfigById[config.id] = config
      injectedDependenciesByVertexId[config.id] = injectedDependencies || {}
   }
   runtimeConfigs.forEach(indexById)

   const exhaustiveVertexConfigs = exhaustiveVertexIds.map(
      id => vertexConfigById[id]
   )

   /////////////////////////////////////////////////
   // Index vertex configs by upstream vertex id //
   ///////////////////////////////////////////////

   const vertexConfigsByUpstreamId: Record<
      symbol,
      Array<VertexConfig<any>>
   > = {}

   exhaustiveVertexConfigs.forEach(config => {
      config.upstreamVertices.forEach(upstreamConfig => {
         if (!vertexConfigsByUpstreamId[upstreamConfig.id]) {
            vertexConfigsByUpstreamId[upstreamConfig.id] = []
         }
         vertexConfigsByUpstreamId[upstreamConfig.id].push(config)
      })
   })

   ///////////////////////////////////////////////
   // Index vertex configs by upstream reducer //
   /////////////////////////////////////////////

   const vertexConfigsByUpstreamReducerId: Record<
      symbol,
      Array<VertexConfig<any>>
   > = {}

   exhaustiveVertexConfigs.forEach(config => {
      const closestCommonAncestorId = (
         config as VertexConfigImpl<any>
      ).findClosestCommonAncestor()
      if (config.id === closestCommonAncestorId) return // It's the root vertex
      if (!vertexConfigsByUpstreamReducerId[closestCommonAncestorId]) {
         vertexConfigsByUpstreamReducerId[closestCommonAncestorId] = []
      }
      vertexConfigsByUpstreamReducerId[closestCommonAncestorId].push(config)
   })

   //////////////////////////////////
   // Ensure only one root vertex //
   ////////////////////////////////

   const rootVertexConfig: VertexConfigImpl<any> = exhaustiveVertexConfigs[0]
      .rootVertex as any
   exhaustiveVertexConfigs.forEach(config =>
      (config as VertexConfigImpl<any>).checkHasRootVertex(rootVertexConfig)
   )

   /////////////////////////
   // Create Redux store //
   ///////////////////////

   const createReduxReducer = (
      vertexConfig: VertexConfig<any>
   ): Reducer<any> => {
      const downstreamVertexConfigs =
         vertexConfigsByUpstreamReducerId[vertexConfig.id] || []
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
         getDefaultMiddleware().concat(epicMiddleware as any) // TODO Remove thunk ?
   })

   const epics = [] as any[]

   const dispatch = (action: UnknownAction) => reduxStore.dispatch(action)

   ////////////////////////////////////
   // Create actual vertex instance //
   //////////////////////////////////

   const fieldsReactionsWhenGraphNotYetReady: UnknownAction[] = []

   const createVertexInstance = <Type extends VertexType>(
      config: VertexConfig<Type>,
      outgoingInternalState$: Observable<VertexInternalState<Type>>,
      dependencies: Type['dependencies']
   ): VertexInstance<Type> => {
      let currentState: VertexState<Type>
      let loadableState$ = new ReplaySubject<VertexLoadableState<Type>>(1) // TODO use some kind of StateObservable ?
      const state$ = loadableState$.pipe(map(_ => _.state)) // TODO use some kind of StateObservable ?
      let currentLoadableState: VertexLoadableState<Type> = null as any
      outgoingInternalState$
         .pipe(
            map(loadableFromInternalState(config.id)),
            distinctUntilChanged(loadableStateEquals)
         )
         .subscribe(loadableState => {
            currentLoadableState = loadableState
            currentState = loadableState.state
            loadableState$.next(loadableState)
         })

      ///////////////////////
      // fieldsReaction() //
      /////////////////////
      ;(config as VertexConfigImpl<Type>).fieldsReactions.forEach(reaction => {
         outgoingInternalState$
            .pipe(
               map(internalState =>
                  pickInternalState(internalState, reaction.fields)
               ),
               distinctUntilChanged(internalStateEquals),
               map(loadableFromInternalState(config.id)),
               filter(_ => _.status === 'loaded')
            )
            .subscribe(pickedLoadableState => {
               const fields = fromLoadableState(pickedLoadableState)
               const action = reaction.operation(fields)
               if (graph) {
                  graph.dispatch(action)
               } else {
                  fieldsReactionsWhenGraphNotYetReady.push(action)
               }
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
               // TODO NOW distinctUntilChanged(loadableStateEquals)
            )
      }

      ///////////////////
      // sideEffect() //
      /////////////////
      ;(config as VertexConfigImpl<Type>).sideEffects.forEach(sideEffect => {
         epics.push(
            mergeMap((action: UnknownAction) => {
               if (action.type === sideEffect.actionCreator.type) {
                  sideEffect.operation(action.payload, vertex)
               }
               return NEVER
            })
         )
      })

      /////////////////
      // reaction() //
      ///////////////
      ;(config as VertexConfigImpl<Type>).reactions.forEach(reaction => {
         const epic = (action$: Observable<UnknownAction>) =>
            reaction.operation(
               action$.pipe(
                  ofType(reaction.actionCreator.type),
                  map(_ => _.payload)
               ),
               vertex
            )
         epics.push(epic)
      })
      return vertex
   }

   /////////////////////////
   // create root vertex //
   ///////////////////////

   const rootDependencies = rootVertexConfig.buildVertexDependencies(
      {},
      injectedDependenciesByVertexId[rootVertexConfig.id]
   )

   const reduxState$ = new Subject<any>()

   const rootIncomingInternalState$ = reduxState$.pipe(
      map(reduxState => ({
         versions: {},
         reduxState,
         readonlyFields: {},
         loadableFields: {}
      }))
   )
   const rootOutgoingInternalState$ = new ReplaySubject<any>(1)
   rootVertexConfig
      .createOutgoingInternalStateStream(
         rootIncomingInternalState$,
         rootDependencies
      )
      .subscribe(rootOutgoingInternalState$)

   const rootVertexInstance = createVertexInstance(
      rootVertexConfig,
      rootOutgoingInternalState$,
      rootDependencies
   )

   /////////////////////////////////////////////////////
   // Create actual vertex instances and index by id //
   ///////////////////////////////////////////////////

   const vertexById: Record<
      symbol,
      {
         instance: VertexInstance<any>
         internalState$: Observable<VertexInternalState<any>>
      }
   > = {
      [rootVertexConfig.id]: {
         instance: rootVertexInstance,
         internalState$: rootOutgoingInternalState$
      }
   }

   const createVertex = <Type extends VertexType>(
      config: VertexConfig<Type>
   ): void => {
      if (vertexById[config.id]) return
      const upstreamVertices = config.upstreamVertices
      if (upstreamVertices.length === 0) return // It's the root vertex
      config.upstreamVertices.forEach(createVertex) // Make sure all upstream vertices are initialized

      //////////////////////////////
      // INCOMING INTERNAL STATE //
      ////////////////////////////
      let incomingInternalState$: Observable<VertexInternalState<Type>>
      if (upstreamVertices.length === 1) {
         const upstreamVertex = upstreamVertices[0]
         const upstreamInternalState$ =
            vertexById[upstreamVertex.id].internalState$
         incomingInternalState$ = (
            config as VertexConfigImpl<Type>
         ).builder.buildIncomingFromSingleUpstreamInternalStateStream(
            upstreamInternalState$
         )
      } else {
         // multiple upstream vertices
         const commonAncestorId = (
            config as VertexConfigImpl<Type>
         ).findClosestCommonAncestor()
         const commonAncestorInternalState$ =
            vertexById[commonAncestorId].internalState$
         const internalStateStreamByDirectAncestorId: Record<
            symbol,
            Observable<VertexInternalState<any>>
         > = {}
         upstreamVertices.forEach(upstreamVertexConfig => {
            const upstreamVertex = vertexById[upstreamVertexConfig.id]
            internalStateStreamByDirectAncestorId[upstreamVertexConfig.id] =
               upstreamVertex.internalState$
         })
         incomingInternalState$ = (
            config as VertexConfigImpl<Type>
         ).builder.buildIncomingFromMultipleUpstreamInternalStateStream(
            commonAncestorInternalState$,
            internalStateStreamByDirectAncestorId
         )
      }

      ///////////////////
      // DEPENDENCIES //
      /////////////////
      const upstreamDependencies = {} as Record<symbol, any>
      config.upstreamVertices.forEach(upstreamVertexConfig => {
         const upstreamVertex = vertexById[upstreamVertexConfig.id]
         upstreamDependencies[upstreamVertexConfig.id] =
            upstreamVertex.instance.dependencies
      })
      const injectedDependencies = injectedDependenciesByVertexId[config.id]
      const dependencies = (
         config as VertexConfigImpl<Type>
      ).buildVertexDependencies(upstreamDependencies, injectedDependencies)

      //////////////////////////////
      // OUTGOING INTERNAL STATE //
      ////////////////////////////
      const outgoingInternalState$ = (
         config as VertexConfigImpl<any>
      ).createOutgoingInternalStateStream(incomingInternalState$, dependencies)
      const instance = createVertexInstance(
         config,
         outgoingInternalState$ as any,
         dependencies
      )
      vertexById[config.id] = {
         instance,
         internalState$: outgoingInternalState$
      }
   }

   exhaustiveVertexConfigs.forEach(createVertex)

   reduxState$.next(reduxStore.getState())
   reduxStore.subscribe(() => reduxState$.next(reduxStore.getState()))

   const graph: Graph = {
      getVertexInstance: config => vertexById[config.id].instance,
      dispatch
   }
   fieldsReactionsWhenGraphNotYetReady.forEach(action => graph.dispatch(action))

   epicMiddleware.run(combineEpics(...epics))

   if (options.devtools) {
      options.devtools({
         graph,
         exhaustiveVertexConfigs
      })
   }

   return graph
}
