import { AnyAction, combineReducers, configureStore } from "@reduxjs/toolkit";
import { Reducer } from "redux";
import { Observable, ReplaySubject, Subject, map } from "rxjs";
import { Graph } from "./Graph";
import { VertexConfig } from "./VertexConfig";
import { VertexConfigImpl } from "./VertexConfigImpl";
import { VertexInstance } from "./VertexInstance";
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

  const vertexConfigsByUpstreamId: Record<symbol, Array<VertexConfig<any>>> = {}

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

  const rootVertexConfig: VertexConfigImpl<any> = uniqueVertexConfigs[0].rootVertex as any

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


  const createVertexInstance = <Type extends VertexType>(
    config: VertexConfig<Type>, internalState$: Observable<VertexInternalState<Type>>, dependencies: Type['dependencies']
  ): VertexInstance<Type> => {
    let currentState: Type['reduxState']
    const state$ = new ReplaySubject<Type['reduxState']>(1)
    let currentInternalState: VertexInternalState<Type> = null as any
    internalState$.subscribe(internalState => {
      currentInternalState = internalState
      currentState = fromInternalState(internalState)
      state$.next(currentState)
    })
    return {
      get id() { return config.id },
      get name() { return config.name },
      get currentState() { return currentState },
      get state$() { return state$ },
      get currentInternalState() { return currentInternalState },
      get internalState$() { return internalState$ },
      get dependencies() { return dependencies },
      dispatch
    }
  }

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

  const reduxState$ = new Subject<any>()

  const originalRootInternalState$ = reduxState$.pipe(
    map((reduxState): VertexInternalState<any> => ({
      status: 'loaded',
      errors: [],
      reduxState,
      readonlyFields: {},
      loadableFields: {}
    }))
  );
  const rootInternalState$ = rootVertexConfig.applyInternalStateTransformations(originalRootInternalState$, rootDependencies)

  const rootVertexInstance = createVertexInstance(rootVertexConfig, rootInternalState$, rootDependencies)

  const vertexById: Record<symbol, { instance: VertexInstance<any>, internalState$: Observable<VertexInternalState<any>> }> = { [rootVertexConfig.id]: { instance: rootVertexInstance, internalState$: rootInternalState$ } }

  const createInternalStateStream = (config: VertexConfigImpl<any>, upstreamInternalState$: Observable<VertexInternalState<any>>, dependencies: any) => {
    const originalInternalState$ = upstreamInternalState$.pipe(
      map((upstream): VertexInternalState<any> => {
        const reduxState = upstream.reduxState.downstream[config.name]
        const readonlyFields: any = {}
        config.upstreamFields.forEach(field => {
          // TODO Define priorities between reduxState, readonlyFields and loadableFields
          // TODO Print warning / throw Error when field on more than one of upstream reduxState/readonlyFields/loadableFields
          if (field in upstream.reduxState.vertex) {
            readonlyFields[field] = upstream.reduxState.vertex[field]
          } else if (field in upstream.readonlyFields) {
            readonlyFields[field] = upstream.readonlyFields[field]
          }
          // TODO handle case when field is loadable fields
        })
        return {
          status: 'loaded',
          errors: [],
          reduxState,
          readonlyFields,
          loadableFields: {} as any // TODO
        }
      })
    )
    return config.applyInternalStateTransformations(originalInternalState$, dependencies)
  }

  const createVertex = <Type extends VertexType>(
    config: VertexConfig<Type>,
  ): void => {
    if (vertexById[config.id]) return
    const upstreamVertexConfig = config.upstreamVertex!
    if (vertexById[upstreamVertexConfig.id] === undefined) {
      createVertex(upstreamVertexConfig)
    }

    const upstreamVertex = vertexById[upstreamVertexConfig.id]
    const dependencies = buildVertexDependencies(config)

    const internalState$: Observable<VertexInternalState<Type>> = createInternalStateStream(config as any, upstreamVertex.internalState$, dependencies) as any
    const instance = createVertexInstance(config, internalState$, dependencies)
    vertexById[config.id] = { instance, internalState$ }
  }

  uniqueVertexConfigs.forEach(createVertex)

  reduxState$.next(reduxStore.getState())
  reduxStore.subscribe(() => reduxState$.next(reduxStore.getState()))

  const graph: Graph = {
    getInstance: (config) => vertexById[config.id].instance,
    dispatch
  }

  return graph
}
