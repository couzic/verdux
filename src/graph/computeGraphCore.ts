import { Reducer, combineReducers } from '@reduxjs/toolkit'
import { BaseActionCreator } from '@reduxjs/toolkit/dist/createAction'
import { VertexConfig } from '../config/VertexConfig'
import { VertexConfigImpl } from '../config/VertexConfigImpl'
import {
   VertexInjectableConfig,
   isInjectedConfig
} from '../config/VertexInjectableConfig'
import { VertexId } from '../vertex/VertexId'
import { GraphCore } from './GraphCore'

export const computeGraphCore = (
   vertexConfigs: Array<VertexInjectableConfig>
): GraphCore => {
   if ((vertexConfigs || []).length === 0)
      throw new Error('createGraph() requires a non-empty vertices array')

   const rootVertexConfig = (
      isInjectedConfig(vertexConfigs[0])
         ? vertexConfigs[0].config.rootVertex
         : vertexConfigs[0].rootVertex
   ) as VertexConfigImpl

   const exhaustiveVertexConfigById: Record<VertexId, VertexConfigImpl> = {}
   const vertexConfigsByUpstreamVertexId: Record<VertexId, VertexConfigImpl[]> =
      {}
   const injectedDependenciesByVertexId: Record<
      VertexId,
      Record<string, any>
   > = {}
   const indexWithUpstreamVertices = (
      injectableConfig: VertexInjectableConfig<any, any>
   ) => {
      const config = (
         isInjectedConfig(injectableConfig)
            ? injectableConfig.config
            : injectableConfig
      ) as VertexConfigImpl
      if (exhaustiveVertexConfigById[config.id]) return // already indexed
      if (config.rootVertex !== rootVertexConfig)
         throw new Error('all vertex configs must have the same root vertex')
      exhaustiveVertexConfigById[config.id] = config
      config.upstreamVertices.forEach(upstreamConfig => {
         if (!vertexConfigsByUpstreamVertexId[upstreamConfig.id]) {
            vertexConfigsByUpstreamVertexId[upstreamConfig.id] = []
         }
         vertexConfigsByUpstreamVertexId[upstreamConfig.id].push(config)
         indexWithUpstreamVertices(upstreamConfig)
      })
      injectedDependenciesByVertexId[config.id] = isInjectedConfig(
         injectableConfig
      )
         ? injectableConfig.injectedDependencies
         : {}
   }
   vertexConfigs.forEach(indexWithUpstreamVertices)

   /** Upstream vertices guaranteed to precede downstream vertices */
   const sortedVertexConfigs: VertexConfigImpl[] = []
   const sortedVertexConfigById: Record<VertexId, VertexConfigImpl> = {}
   const indexWithDownstreamVertices = (config: VertexConfigImpl) => {
      if (sortedVertexConfigById[config.id]) return // already indexed
      sortedVertexConfigById[config.id] = config
      sortedVertexConfigs.push(config)
      const downstreamConfigs = vertexConfigsByUpstreamVertexId[config.id] || []
      downstreamConfigs.forEach(downstreamConfig => {
         if (
            downstreamConfig.upstreamVertices.every(
               config => sortedVertexConfigById[config.id]
            )
         ) {
            indexWithDownstreamVertices(downstreamConfig)
         }
      })
   }
   indexWithDownstreamVertices(rootVertexConfig)

   const vertexConfigsByClosestCommonAncestorId: Partial<
      Record<VertexId, VertexConfigImpl[]>
   > = {}
   sortedVertexConfigs.forEach(config => {
      if (config === rootVertexConfig) return
      const closestCommonAncestorId = config.findClosestCommonAncestor()
      if (!vertexConfigsByClosestCommonAncestorId[closestCommonAncestorId]) {
         vertexConfigsByClosestCommonAncestorId[closestCommonAncestorId] = []
      }
      vertexConfigsByClosestCommonAncestorId[closestCommonAncestorId]!.push(
         config
      )
   })

   ///////////////////
   // DEPENDENCIES //
   /////////////////
   const dependenciesByVertexId: Record<VertexId, Record<string, any>> = {}

   sortedVertexConfigs.forEach(config => {
      dependenciesByVertexId[config.id] = config.buildVertexDependencies(
         dependenciesByVertexId,
         injectedDependenciesByVertexId[config.id]
      )
   })

   //////////////
   // REDUCER //
   ////////////
   const createReduxReducer = (vertexConfig: VertexConfig<any>): Reducer => {
      const downstreamVertexConfigs =
         vertexConfigsByClosestCommonAncestorId[vertexConfig.id] || []
      if (downstreamVertexConfigs.length === 0)
         return combineReducers({
            vertex: vertexConfig.reducer
         })
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

   ///////////////
   // SUBGRAPH //
   /////////////
   const vertexIdsInSubgraph: Record<VertexId, VertexId[]> = {}
   const trackedActionsInSubgraph: Record<
      VertexId,
      BaseActionCreator<any, any>[]
   > = {}
   const indexSubgraph = (config: VertexConfigImpl) => {
      const ids = [config.id]
      const trackedActions = [...config.trackedActions]
      const downstreamConfigs =
         vertexConfigsByClosestCommonAncestorId[config.id] || []
      downstreamConfigs.forEach(downstreamConfig => {
         indexSubgraph(downstreamConfig)
         ids.push(...vertexIdsInSubgraph[downstreamConfig.id])
         trackedActions.push(...trackedActionsInSubgraph[downstreamConfig.id])
      })
      vertexIdsInSubgraph[config.id] = ids
      trackedActionsInSubgraph[config.id] = trackedActions
   }
   indexSubgraph(rootVertexConfig)

   return {
      vertexConfigs: sortedVertexConfigs,
      vertexConfigsByClosestCommonAncestorId,
      vertexIdsInSubgraph,
      trackedActionsInSubgraph,
      dependenciesByVertexId,
      rootReducer
   }
}
