import { UnknownAction } from '@reduxjs/toolkit'
import { VertexId } from '../vertex/VertexId'
import { VertexChangedFields, VertexFields } from './VertexFields'

export interface RunData {
   action: UnknownAction | undefined
   fieldsReactions: UnknownAction[]
   reactions: UnknownAction[]
   sideEffects: Array<() => void>
   initialRun: boolean
}

export interface GraphRunData extends RunData {
   fieldsByVertexId: Record<VertexId, VertexFields>
   changedFieldsByVertexId: Record<VertexId, VertexChangedFields>
}

export interface VertexRunData extends RunData {
   fields: VertexFields
   changedFields: VertexChangedFields
}
