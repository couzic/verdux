import { AnyAction, combineReducers, configureStore } from "@reduxjs/toolkit";
import { Reducer } from "redux";
import { ReplaySubject, Subject } from "rxjs";
import { DownstreamVertexConfig } from "./DownstreamVertexConfig";
import { Graph } from "./Graph";
import { RootVertexConfig } from "./RootVertexConfig";
import { Vertex } from "./Vertex";
import { VertexConfig } from "./VertexConfig";
import { VertexInternalState } from "./VertexInternalState";
import { VertexRuntimeConfig } from './VertexRuntimeConfig';
import { VertexType } from "./VertexType";
import { fromInternalState } from "./fromInternalState";

export const createGraph = (options: {
  vertices: Array<VertexRuntimeConfig<any>>
}) => {

  const runtimeConfigs = options.vertices
  if (runtimeConfigs.length === 0) throw new Error('createGraph() does not accept an empty vertices array')

  const uniqueVertexIds: Array<symbol> = []
  const vertexConfigById: Record<symbol, VertexConfig<any>> = {}
  const injectedDependenciesByVertexId: Record<symbol, any> = {}

  const indexById = (runtimeConfig: VertexRuntimeConfig<any>) => {
    const dependencies = 'config' in runtimeConfig ? runtimeConfig.dependencies : null
    const config = 'config' in runtimeConfig ? runtimeConfig.config : runtimeConfig
    const upstreamConfig = config.upstreamVertex
    if (upstreamConfig) {
      indexById(upstreamConfig)
    }
    if (!vertexConfigById[config.id]) {
      uniqueVertexIds.push(config.id)
      vertexConfigById[config.id] = config
      if (dependencies) {
        injectedDependenciesByVertexId[config.id] = dependencies
      }
    }
  }
  runtimeConfigs.forEach(indexById)

  const uniqueVertexConfigs = uniqueVertexIds
    .map(id => vertexConfigById[id])

  const vertexConfigsByUpstreamId: Record<symbol, Array<DownstreamVertexConfig<any>>> = {}

  uniqueVertexConfigs.forEach(config => {
    const upstreamConfig = config.upstreamVertex
    if (upstreamConfig !== undefined) {
      if (!vertexConfigsByUpstreamId[upstreamConfig.id]) {
        vertexConfigsByUpstreamId[upstreamConfig.id] = []
      }
      vertexConfigsByUpstreamId[upstreamConfig.id].push(config as DownstreamVertexConfig<any>)
    }
  })

  // TODO Make sure all upstream vertex configs are indexed by ID, even if they were not explicitely passed to the vertices array in options
  // TODO print warning if upstream vertex is not passed in vertices array

  const rootVertexConfig = uniqueVertexConfigs[0].rootVertex as RootVertexConfig<any>

  const createReduxReducer = (vertexConfig: VertexConfig<any>): Reducer<any> => {
    const downstreamVertexConfigs = vertexConfigsByUpstreamId[vertexConfig.id] || []
    if (downstreamVertexConfigs.length === 0) return combineReducers({ vertex: vertexConfig.reducer })

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

  const reduxStore = configureStore({
    reducer: rootReducer
  })

  const dispatch = (action: AnyAction) => reduxStore.dispatch(action)

  const reduxState$ = new Subject()

  let rootCurrentState = reduxStore.getState()
  const rootState$ = new ReplaySubject<any>(1)
  let rootCurrentInternalState = null as any

  const buildVertexDependencies = (config: VertexConfig<any>) => {
    const providers = rootVertexConfig.dependencyProviders
    const dependencyNames = Object.keys(providers)
    const injectedDependencies = injectedDependenciesByVertexId[config.id] || {}
    const dependencies = {} as any
    dependencyNames.forEach(depName => {
      const injectedDep = injectedDependencies[depName]
      if (injectedDep) {
        dependencies[depName] = injectedDep
      } else {
        dependencies[depName] = providers[depName]({})
      }
    })
    return dependencies
  }

  const rootDependencies = buildVertexDependencies(rootVertexConfig)
  const rootInternalState$ = rootVertexConfig.createInternalStateStreamFromRedux(reduxState$, rootDependencies)
  rootInternalState$.subscribe(internalState => {
    rootCurrentInternalState = internalState
    rootCurrentState = fromInternalState(internalState)
    rootState$.next(rootCurrentState)
  })
  const rootVertex: Vertex<any> = {
    get id() { return rootVertexConfig.id },
    get name() { return rootVertexConfig.name },
    get currentState() { return rootCurrentState },
    get state$() { return rootState$ },
    get currentInternalState() { return rootCurrentInternalState },
    get internalState$() { return rootInternalState$ },
    get dependencies() { return rootDependencies },
    dispatch
  }

  const vertexById: Record<symbol, Vertex<any>> = { [rootVertexConfig.id]: rootVertex }

  const createVertex = <Type extends VertexType>(
    config: DownstreamVertexConfig<Type>,
  ) => {
    const alreadyCreatedVertex = vertexById[config.id]
    if (alreadyCreatedVertex) return alreadyCreatedVertex
    const upstreamConfig = config.upstreamVertex!
    if (vertexById[upstreamConfig.id] === undefined) {
      const upstreamVertex = createVertex(upstreamConfig as DownstreamVertexConfig<any>)
      vertexById[upstreamVertex.id] = upstreamVertex
    }

    const upstreamVertex = vertexById[upstreamConfig.id]
    let currentState: Type['reduxState']
    const state$ = new ReplaySubject<Type['reduxState']>(1)
    let currentInternalState: VertexInternalState<Type> = null as any
    const dependencies = buildVertexDependencies(config)
    const internalState$ = config.createInternalStateStreamFromUpstream(upstreamVertex.internalState$ as any, dependencies)
    internalState$.subscribe(internalState => {
      currentInternalState = internalState
      currentState = fromInternalState(internalState)
      state$.next(currentState)
    })
    const vertex: Vertex<Type> = {
      get id() { return config.id },
      get name() { return config.name },
      get currentState() { return currentState },
      get state$() { return state$ },
      get currentInternalState() { return currentInternalState },
      get internalState$() { return internalState$ },
      get dependencies() { return dependencies },
      dispatch
    }
    vertexById[config.id] = vertex
    return vertex
  }

  uniqueVertexConfigs.forEach(config => createVertex(config as any))

  reduxState$.next(reduxStore.getState())
  reduxStore.subscribe(() => reduxState$.next(reduxStore.getState()))

  const graph: Graph = {
    getInstance: (config) => vertexById[config.id],
    dispatch
  }

  return graph
}
