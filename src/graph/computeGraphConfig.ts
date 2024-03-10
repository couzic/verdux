import { VertexConfig } from '../config/VertexConfig'
import { VertexRuntimeConfig } from '../config/VertexRuntimeConfig'
import { VertexId } from '../vertex/VertexId'
import { GraphConfig } from './GraphConfig'

export const computeGraphConfig = (
   vertexConfigs: Array<VertexRuntimeConfig<any>>
): GraphConfig => {
   if ((vertexConfigs || []).length === 0)
      throw new Error('createGraph() requires a non-empty vertices array')

   const rootVertexConfig =
      'config' in vertexConfigs[0]
         ? vertexConfigs[0].config.rootVertex
         : vertexConfigs[0].rootVertex

   // TODO sorted in optimal order
   // TODO ensure no cycles
   // TODO single upstream vertex ids

   const vertexIds: VertexId[] = []
   const vertexIdsBySingleUpstreamVertexId: Record<VertexId, VertexId[]> = {}
   const vertexConfigById: Record<VertexId, VertexConfig<any>> = {}
   const injectedDependenciesByVertexId: Record<VertexId, any> = {}

   const processConfig = (runtimeConfig: VertexRuntimeConfig<any>) => {
      const config =
         'config' in runtimeConfig ? runtimeConfig.config : runtimeConfig
      // TODO deduplicate configs
      // if (vertexConfigById[config.id]) return
      if (config.rootVertex !== rootVertexConfig)
         throw new Error('all vertex configs must have the same root vertex')
      const injectedDependencies =
         'config' in runtimeConfig ? runtimeConfig.injectedDependencies : null
      // TODO upstream vertices should be processed first
      // config.upstreamVertices.forEach(processConfig)
      vertexIds.push(config.id)
      vertexConfigById[config.id] = config

      // TODO ACTUAL DEPENDENCIES !!!
      ///////////////////
      // DEPENDENCIES //
      /////////////////
      // const upstreamDependencies = {} as Record<symbol, any>
      // config.upstreamVertices.forEach(upstreamVertexConfig => {
      //    const upstreamVertex = vertexById[upstreamVertexConfig.id]
      //    upstreamDependencies[upstreamVertexConfig.id] =
      //       upstreamVertex.instance.dependencies
      // })
      // const injectedDependencies = injectedDependenciesByVertexId[config.id]
      // const dependencies = (
      //    config as VertexConfigImpl<Type>
      // ).buildVertexDependencies(upstreamDependencies, injectedDependencies)

      injectedDependenciesByVertexId[config.id] = injectedDependencies || {}
   }
   vertexConfigs.forEach(processConfig)
   return {
      vertexIds,
      vertexIdsBySingleUpstreamVertexId,
      vertexConfigById,
      injectedDependenciesByVertexId
   }
}
