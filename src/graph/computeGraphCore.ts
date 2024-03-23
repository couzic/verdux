import { Reducer, combineReducers } from '@reduxjs/toolkit'
import { filter, map, merge, pipe, scan, share, tap } from 'rxjs'
import { VertexConfig } from '../config/VertexConfig'
import { VertexConfigImpl } from '../config/VertexConfigImpl'
import {
   VertexInjectableConfig,
   isInjectedConfig
} from '../config/VertexInjectableConfig'
import { VertexFieldState } from '../state/VertexFieldState'
import { VertexReduxState } from '../state/VertexReduxState'
import { VertexData } from '../vertex/VertexData'
import { VertexId } from '../vertex/VertexId'
import { GraphCore } from './GraphCore'
import { GraphPipeline } from './GraphPipeline'
import {
   GraphTransformable,
   GraphTransformation,
   VertexTransformable,
   VertexTransformation
} from './Transformable'

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
   const graphTansformations: GraphTransformation[] = []
   const sortDownstreamVertexIds = (config: VertexConfigImpl) => {
      if (isVertexSorted[config.id]) return
      isVertexSorted[config.id] = true
      sortedVertexIds.push(config.id)
      addGraphTransformation(config)
      const downstreamVertexConfigs =
         vertexConfigsBySingleUpstreamVertexId[config.id] || []
      downstreamVertexConfigs.forEach(sortDownstreamVertexIds)
   }

   const addGraphTransformation = (config: VertexConfigImpl) => {
      const upstreamReducerId = config.findClosestCommonAncestor()
      const isRootVertex = config.id === upstreamReducerId
      const getReduxState: (
         vertices: Record<VertexId, VertexData>
      ) => VertexReduxState = isRootVertex
         ? vertices => vertices[config.id].reduxState
         : vertices =>
              vertices[upstreamReducerId].reduxState.downstream[config.name]
      const { upstreamVertices, fieldsByUpstreamVertexId } = config.builder
      const vertexTransformations = config.transformations as [
         VertexTransformation
      ]
      const graphTransformation: GraphTransformation =
         inputGraphTransformable$ => {
            let lastInputVertices: Record<VertexId, VertexData>
            let lastVertexFields: Record<string, VertexFieldState>
            const maybeChanged$ = inputGraphTransformable$.pipe(
               map(graphTransformable => {
                  lastInputVertices = graphTransformable.vertices
                  // TODO Optimize: check if changed before building fields from redux state
                  // FIELDS FROM REDUX STATE
                  const reduxState = getReduxState(graphTransformable.vertices)
                  const vertexFields = {} as Record<string, VertexFieldState>
                  Object.keys(reduxState.vertex).forEach(key => {
                     vertexFields[key] = {
                        status: 'loaded',
                        value: reduxState.vertex[key],
                        errors: []
                     }
                  })
                  // FIELDS FROM UPSTREAM VERTICES
                  upstreamVertices.forEach(upstreamVertex => {
                     const upstreamFields =
                        graphTransformable.vertices[upstreamVertex.id].fields
                     fieldsByUpstreamVertexId[upstreamVertex.id].forEach(
                        field => {
                           vertexFields[field] = upstreamFields[field]
                        }
                     )
                  })
                  return {
                     graphTransformable,
                     vertexFields
                  }
               }),
               scan(
                  (previous, next) => {
                     const hasChanged = !previous
                        ? true
                        : // TODO use compareFields()
                          Object.keys(next.vertexFields).some(field => {
                             const previousField = previous.vertexFields[field]
                             const nextField = next.vertexFields[field]
                             return (
                                previousField.status !== nextField.status ||
                                previousField.value !== nextField.value
                             )
                          })
                     return { ...next, hasChanged }
                  },
                  undefined as any as {
                     graphTransformable: GraphTransformable
                     vertexFields: Record<string, VertexFieldState>
                     hasChanged: boolean
                  }
               ),
               share()
            )
            const hasChanged$ = maybeChanged$.pipe(filter(_ => _.hasChanged))
            const hasNotChanged$ = maybeChanged$.pipe(
               filter(_ => !_.hasChanged)
            )
            const vertexTransformableWhenChanged$ = hasChanged$.pipe(
               map(
                  ({
                     graphTransformable,
                     vertexFields
                  }): VertexTransformable => ({
                     ...graphTransformable,
                     vertexFields
                  })
               ),
               ...vertexTransformations,
               tap(_ => (lastVertexFields = _.vertexFields))
            )
            const vertexTransformableWhenNotChanged$ = hasNotChanged$.pipe(
               map(
                  ({ graphTransformable }): VertexTransformable => ({
                     ...graphTransformable,
                     vertexFields: lastVertexFields
                  })
               )
            )
            return merge(
               vertexTransformableWhenChanged$,
               vertexTransformableWhenNotChanged$
            ).pipe(
               map(
                  (vertexTransformable): GraphTransformable => ({
                     ...vertexTransformable,
                     vertices: {
                        ...lastInputVertices,
                        [config.id]: {
                           reduxState: getReduxState(lastInputVertices),
                           fields: vertexTransformable.vertexFields
                        }
                     }
                  })
               )
            )
         }
      // TODO downstream vertex transformations should be skipped if vertex fields have not changed
      graphTansformations.push(graphTransformation)
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
            vertices: {
               [rootVertexConfig.id]: {
                  reduxState,
                  fields
               }
            },
            fieldsReactions: [],
            reactions: [],
            action
         }
      }),
      ...(graphTansformations as [GraphTransformation])
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
