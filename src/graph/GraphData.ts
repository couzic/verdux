import { UnknownAction } from '@reduxjs/toolkit'
import { VertexData } from '../vertex/VertexData'
import { VertexId } from '../vertex/VertexId'

export interface GraphData {
   vertices: Record<VertexId, VertexData>
   fieldsReactions: UnknownAction[]
   reactions: UnknownAction[]
}
