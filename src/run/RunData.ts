import { UnknownAction } from '@reduxjs/toolkit'
import { VertexReduxState } from '../state/VertexReduxState'
import { VertexId } from '../vertex/VertexId'
import { VertexChangedFields, VertexFields } from './VertexFields'

export interface RunData {
   action: UnknownAction | undefined
   fieldsReactions: UnknownAction[]
   reactions: UnknownAction[]
}

export interface GraphRunData extends RunData {
   reduxStateByVertexId: Record<VertexId, VertexReduxState>
   fieldsByVertexId: Record<VertexId, VertexFields>
   changedFieldsByVertexId: Record<VertexId, VertexChangedFields>
}

export interface VertexRunData extends RunData {
   fields: VertexFields
   changedFields: VertexChangedFields
}
