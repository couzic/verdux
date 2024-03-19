import { Reducer } from '@reduxjs/toolkit'
import { VertexConfig } from '../config/VertexConfig'
import { VertexId } from '../vertex/VertexId'
import { GraphPipeline } from './GraphPipeline'

export interface GraphCore {
   /** exhaustive and sorted */
   vertexIds: VertexId[]
   vertexConfigsBySingleUpstreamVertexId: Record<
      VertexId,
      VertexConfig<any, any>[]
   >
   vertexConfigById: Record<VertexId, VertexConfig<any>>
   dependenciesByVertexId: Record<VertexId, Record<string, any>>
   rootReducer: Reducer
   pipeline: GraphPipeline
}
