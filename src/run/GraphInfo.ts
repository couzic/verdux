import { BaseActionCreator } from '@reduxjs/toolkit/dist/createAction'
import { VertexConfigImpl } from '../config/VertexConfigImpl'
import { VertexId } from '../vertex/VertexId'

export interface GraphInfo {
   vertexConfigsByClosestCommonAncestorId: Partial<
      Record<VertexId, VertexConfigImpl[]>
   >
   vertexIdsInSubgraph: Record<VertexId, VertexId[]>
   trackedActionsInSubgraph: Record<VertexId, BaseActionCreator<any, any>[]>
   dependenciesByVertexId: Record<VertexId, Record<string, any>>
}
