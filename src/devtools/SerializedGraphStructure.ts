import { VertexId } from '../vertex/VertexId'

export interface SerializedGraphStructure {
   vertices: SerializedVertexStructure[]
   edges: SerializedEdgeStructure[]
}

export interface SerializedVertexStructure {
   id: VertexId
   name: string
   isRoot: boolean
}

export interface SerializedEdgeStructure {
   upstream: VertexId
   downstream: VertexId
   fields: string[]
}
