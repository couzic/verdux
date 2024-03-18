import { VertexConfig } from '../config/VertexConfig'
import { VertexConfigImpl } from '../config/VertexConfigImpl'
import { VertexInjectedConfig } from '../config/VertexInjectedConfig'
import { VertexId } from '../vertex/VertexId'
import { GraphConfig } from './GraphConfig'

export const computeGraphConfig = (
   vertexConfigs: Array<VertexInjectedConfig<any>>
): GraphConfig => {
   if ((vertexConfigs || []).length === 0)
      throw new Error('createGraph() requires a non-empty vertices array')

   const rootVertexConfig =
      'config' in vertexConfigs[0]
         ? vertexConfigs[0].config.rootVertex
         : vertexConfigs[0].rootVertex

   // TODO ensure no cycles

   const exhaustiveVertexConfigs: VertexConfig<any, any>[] = []
   const vertexConfigsBySingleUpstreamVertexId: Record<
      VertexId,
      VertexConfig<any, any>[]
   > = {}
   const vertexConfigsWithMultipleUpstreamVertices: VertexConfig[] = []
   const vertexConfigById: Record<VertexId, VertexConfig<any>> = {}
   const dependenciesByVertexId: Record<VertexId, Record<string, any>> = {}
   const injectedDependenciesByVertexId: Record<
      VertexId,
      Record<string, any>
   > = {}

   const indexExhaustiveVertexIds = (
      runtimeConfig: VertexInjectedConfig<any>
   ) => {
      const config =
         'config' in runtimeConfig ? runtimeConfig.config : runtimeConfig
      if (vertexConfigById[config.id]) return
      vertexConfigById[config.id] = config
      if (config.rootVertex !== rootVertexConfig)
         throw new Error('all vertex configs must have the same root vertex')
      config.upstreamVertices.forEach(indexExhaustiveVertexIds)
      injectedDependenciesByVertexId[config.id] =
         'config' in runtimeConfig ? runtimeConfig.injectedDependencies : {}
      // TODO Check config is not root OR config.upstreamVertices.length >= 0
      if (config.upstreamVertices.length === 1) {
         const upstreamVertexId = config.upstreamVertices[0].id
         const siblingVertexConfigs =
            vertexConfigsBySingleUpstreamVertexId[upstreamVertexId]
         if (siblingVertexConfigs) siblingVertexConfigs.push(config)
         else vertexConfigsBySingleUpstreamVertexId[upstreamVertexId] = [config]
      } else if (config.upstreamVertices.length > 1) {
         vertexConfigsWithMultipleUpstreamVertices.push(config)
      }
      exhaustiveVertexConfigs.push(config)
   }
   vertexConfigs.forEach(indexExhaustiveVertexIds)

   const sortedVertexIds: VertexId[] = []
   const isVertexSorted: Record<VertexId, boolean> = {}
   const sortDownstreamVertexIds = (config: VertexConfig<any, any>) => {
      if (isVertexSorted[config.id]) return
      isVertexSorted[config.id] = true
      sortedVertexIds.push(config.id)
      const dependencies = (config as VertexConfigImpl).buildVertexDependencies(
         dependenciesByVertexId,
         injectedDependenciesByVertexId[config.id]
      )
      dependenciesByVertexId[config.id] = dependencies
      const downstreamVertexConfigs =
         vertexConfigsBySingleUpstreamVertexId[config.id] || []
      downstreamVertexConfigs.forEach(sortDownstreamVertexIds)
   }
   sortDownstreamVertexIds(rootVertexConfig)
   vertexConfigsWithMultipleUpstreamVertices.forEach(sortDownstreamVertexIds)

   return {
      vertexIds: sortedVertexIds,
      vertexConfigsBySingleUpstreamVertexId,
      vertexConfigById,
      dependenciesByVertexId
   }
}
