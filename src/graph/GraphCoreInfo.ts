import { BaseActionCreator } from '@reduxjs/toolkit/dist/createAction'
import { VertexConfigImpl } from '../config/VertexConfigImpl'
import { Reducer } from '@reduxjs/toolkit'
import { VertexRun } from '../run/VertexRun'
import { VertexId } from '../vertex/VertexId'

export interface GraphCoreInfo {
   /** exhaustive and sorted */
   vertexConfigs: VertexConfigImpl[]
   operationsByVertexId: Record<VertexId, [VertexRun]>
   rootReducer: Reducer
   vertexConfigsByClosestCommonAncestorId: Partial<
      Record<VertexId, VertexConfigImpl[]>
   >
   vertexIdsInSubgraph: Record<VertexId, VertexId[]>
   trackedActionsInSubgraph: Record<VertexId, BaseActionCreator<any, any>[]>
   dependenciesByVertexId: Record<VertexId, Record<string, any>> // TODO Remove ?
}
