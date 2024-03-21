import { Reducer, combineReducers } from '@reduxjs/toolkit'
import { map, pipe } from 'rxjs'
import { VertexConfig } from '../config/VertexConfig'
import { VertexConfigImpl } from '../config/VertexConfigImpl'
import {
   VertexInjectableConfig,
   isInjectedConfig
} from '../config/VertexInjectableConfig'
import { VertexFieldState } from '../state/VertexFieldState'
import { VertexId } from '../vertex/VertexId'
import { GraphCore } from './GraphCore'
import { GraphPipeline } from './GraphPipeline'
import { GraphTransformation } from './GraphTransformation'

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

   /** Upstream vertices guaranteed to precede downstream vertices */
   const exhaustiveVertexConfigs: VertexConfigImpl[] = []
   const vertexConfigsBySingleUpstreamVertexId: Record<
      VertexId,
      VertexConfigImpl[]
   > = {}
   const vertexConfigsWithMultipleUpstreamVertices: VertexConfigImpl[] = []
   const vertexConfigById: Record<VertexId, VertexConfig<any>> = {}
   const vertexConfigsByUpstreamReducerId: Record<
      VertexId,
      Array<VertexConfig<any>>
   > = {}
   const injectedDependenciesByVertexId: Record<
      VertexId,
      Record<string, any>
   > = {}
   const dependenciesByVertexId: Record<VertexId, Record<string, any>> = {}

   const indexWithUpstreamConfigs = (
      injectableConfig: VertexInjectableConfig<any, any>
   ) => {
      const config = (
         isInjectedConfig(injectableConfig)
            ? injectableConfig.config
            : injectableConfig
      ) as VertexConfigImpl
      if (vertexConfigById[config.id]) return // already indexed
      if (config.rootVertex !== rootVertexConfig)
         // TODO Check config is not root OR config.upstreamVertices.length >= 0
         throw new Error('all vertex configs must have the same root vertex')
      // TODO check there are no cycles by checking if the config is not already awaiting upstream configs to be indexed
      config.upstreamVertices.forEach(indexWithUpstreamConfigs)
      vertexConfigById[config.id] = config
      injectedDependenciesByVertexId[config.id] = isInjectedConfig(
         injectableConfig
      )
         ? injectableConfig.injectedDependencies
         : {}
      indexByUpstreamVertex(config)
      indexByUpstreamReducer(config)
      exhaustiveVertexConfigs.push(config)
   }

   const indexByUpstreamVertex = (config: VertexConfigImpl) => {
      if (config.upstreamVertices.length === 1) {
         const upstreamVertexId = config.upstreamVertices[0].id
         const siblingVertexConfigs =
            vertexConfigsBySingleUpstreamVertexId[upstreamVertexId]
         if (siblingVertexConfigs) siblingVertexConfigs.push(config)
         else vertexConfigsBySingleUpstreamVertexId[upstreamVertexId] = [config]
      } else if (config.upstreamVertices.length > 1) {
         vertexConfigsWithMultipleUpstreamVertices.push(config)
      }
   }

   const indexByUpstreamReducer = (config: VertexConfigImpl) => {
      const closestCommonAncestorId = config.findClosestCommonAncestor()
      if (config.id === closestCommonAncestorId) return // It's the root vertex
      if (!vertexConfigsByUpstreamReducerId[closestCommonAncestorId]) {
         vertexConfigsByUpstreamReducerId[closestCommonAncestorId] = []
      }
      vertexConfigsByUpstreamReducerId[closestCommonAncestorId].push(config)
   }

   vertexConfigs.forEach(indexWithUpstreamConfigs)

   ///////////////////
   // DEPENDENCIES //
   /////////////////
   exhaustiveVertexConfigs.forEach(config => {
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

   //////////////////////
   // TRANSFORMATIONS //
   ////////////////////
   const sortedVertexIds: VertexId[] = []
   const isVertexSorted: Record<VertexId, boolean> = {}
   const transformations: GraphTransformation[] = []
   const sortDownstreamVertexIds = (config: VertexConfigImpl) => {
      if (isVertexSorted[config.id]) return
      isVertexSorted[config.id] = true
      sortedVertexIds.push(config.id)
      addTransformations(config)
      const downstreamVertexConfigs =
         vertexConfigsBySingleUpstreamVertexId[config.id] || []
      downstreamVertexConfigs.forEach(sortDownstreamVertexIds)
   }

   const addTransformations = (config: VertexConfigImpl) => {
      const upstreamReducerId = config.findClosestCommonAncestor()
      const isRootVertex = config.id === upstreamReducerId
      const { upstreamVertices, fieldsByUpstreamVertexId } = config.builder
      const transformation: GraphTransformation = map(
         ({ graphData, action }) => {
            const reduxState = isRootVertex
               ? graphData.vertices[config.id].reduxState
               : graphData.vertices[upstreamReducerId].reduxState.downstream[
                    config.name
                 ]
            const fields = {} as Record<string, VertexFieldState>
            Object.keys(reduxState.vertex).forEach(key => {
               fields[key] = {
                  status: 'loaded',
                  value: reduxState.vertex[key],
                  errors: []
               }
            })
            upstreamVertices.forEach(upstreamVertex => {
               const upstreamFields =
                  graphData.vertices[upstreamVertex.id].fields
               fieldsByUpstreamVertexId[upstreamVertex.id].forEach(field => {
                  fields[field] = upstreamFields[field]
               })
            })
            return {
               graphData: {
                  vertices: {
                     ...graphData.vertices,
                     [config.id]: {
                        reduxState,
                        fields
                     }
                  },
                  fieldsReactions: [],
                  reactions: []
               },
               action
            }
         }
      )
      // TODO downstream vertex transformations should be skipped if vertex fields have not changed
      transformations.push(transformation, ...config.transformations)
   }

   sortDownstreamVertexIds(rootVertexConfig)
   vertexConfigsWithMultipleUpstreamVertices.forEach(sortDownstreamVertexIds)

   // TODO Add all vertices in graph data
   // TODO Apply transformations for each vertex IN CORRECT ORDER
   // TODO Make sure a transformation is called only if its upstream vertex has changed
   const pipeline: GraphPipeline = pipe(
      map(({ reduxState, action }) => {
         const rootVertexReduxState = reduxState.vertex
         const fields = {} as Record<string, VertexFieldState>
         Object.keys(rootVertexReduxState).forEach(key => {
            fields[key] = {
               status: 'loaded',
               value: rootVertexReduxState[key],
               errors: []
            }
         })
         return {
            graphData: {
               vertices: {
                  [rootVertexConfig.id]: {
                     reduxState,
                     fields
                  }
               },
               fieldsReactions: [],
               reactions: []
            },
            action
         }
      }),
      ...(transformations as [GraphTransformation])
   )

   return {
      vertexIds: sortedVertexIds,
      vertexConfigsBySingleUpstreamVertexId,
      vertexConfigById,
      dependenciesByVertexId,
      rootReducer,
      pipeline
   }
}
