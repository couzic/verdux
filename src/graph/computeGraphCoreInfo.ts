import { Reducer, combineReducers } from '@reduxjs/toolkit'
import { BaseActionCreator } from '@reduxjs/toolkit/dist/createAction'
import { VertexConfig } from '../config/VertexConfig'
import { VertexConfigImpl } from '../config/VertexConfigImpl'
import {
   VertexInjectableConfig,
   isInjectedConfig
} from '../config/VertexInjectableConfig'
import { VertexRun } from '../run/VertexRun'
import { VertexId } from '../vertex/VertexId'
import { GraphCoreInfo } from './GraphCoreInfo'
import { VerduxLogger } from './VerduxLogger'

export const computeGraphCoreInfo = (
   vertexConfigs: Array<VertexInjectableConfig>,
   logger?: VerduxLogger
): GraphCoreInfo => {
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
      const alreadyIndexedConfig = exhaustiveVertexConfigById[config.id]
      if (alreadyIndexedConfig) {
         if (alreadyIndexedConfig === config) {
            return // already indexed
         } else {
            throw new Error(`Duplicate vertex id: ${config.id}`)
         }
      }
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

   // Redux-tree path (root → … → vertex) for every vertex. The redux state tree
   // nests by closest-common-ancestor and by `config.name`; this path lets a run
   // re-derive a vertex's (and its ancestors') redux substate from the live root
   // state. See `runVertex` and ARCHITECTURE.md §6.
   const reduxParentByVertexId: Record<VertexId, VertexConfigImpl> = {}
   Object.keys(vertexConfigsByClosestCommonAncestorId).forEach(ancestorId => {
      vertexConfigsByClosestCommonAncestorId[ancestorId]!.forEach(child => {
         reduxParentByVertexId[child.id] = sortedVertexConfigById[ancestorId]
      })
   })
   const reduxPathByVertexId: Record<VertexId, VertexConfigImpl[]> = {}
   sortedVertexConfigs.forEach(config => {
      const path: VertexConfigImpl[] = [config]
      let parent = reduxParentByVertexId[config.id]
      while (parent) {
         path.unshift(parent)
         parent = reduxParentByVertexId[parent.id]
      }
      reduxPathByVertexId[config.id] = path
   })

   ///////////////////
   // DEPENDENCIES //
   /////////////////
   const dependenciesByVertexId: Record<VertexId, Record<string, any>> = {}
   const operationsByVertexId: Record<VertexId, [VertexRun]> = {}
   const trackedActionsByVertexId: Record<
      VertexId,
      BaseActionCreator<any, any>[]
   > = {}

   sortedVertexConfigs.forEach(config => {
      dependenciesByVertexId[config.id] = config.buildVertexDependencies(
         dependenciesByVertexId,
         injectedDependenciesByVertexId[config.id]
      )
      const { operations, trackedActions } = config.resolveOperations(
         dependenciesByVertexId[config.id],
         logger
      )
      operationsByVertexId[config.id] = operations
      trackedActionsByVertexId[config.id] = trackedActions
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
      const trackedActions: BaseActionCreator<any, any>[] = []
      const addTrackedAction = (action: BaseActionCreator<any, any>) => {
         if (!trackedActions.includes(action)) trackedActions.push(action)
      }
      trackedActionsByVertexId[config.id].forEach(addTrackedAction)
      const downstreamConfigs =
         vertexConfigsByClosestCommonAncestorId[config.id] || []
      downstreamConfigs.forEach(downstreamConfig => {
         indexSubgraph(downstreamConfig)
         ids.push(...vertexIdsInSubgraph[downstreamConfig.id])
         trackedActionsInSubgraph[downstreamConfig.id].forEach(addTrackedAction)
      })
      vertexIdsInSubgraph[config.id] = ids
      trackedActionsInSubgraph[config.id] = trackedActions
   }
   indexSubgraph(rootVertexConfig)

   return {
      vertexConfigs: sortedVertexConfigs,
      vertexConfigsByClosestCommonAncestorId,
      reduxPathByVertexId,
      vertexIdsInSubgraph,
      trackedActionsInSubgraph,
      dependenciesByVertexId,
      operationsByVertexId,
      rootReducer
   }
}
