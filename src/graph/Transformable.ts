import { UnknownAction } from '@reduxjs/toolkit'
import { Observable } from 'rxjs'
import { VertexFieldState } from '../state/VertexFieldState'
import { VertexData } from '../vertex/VertexData'
import { VertexId } from '../vertex/VertexId'

export interface Transformable {
   action?: UnknownAction
   fieldsReactions: UnknownAction[]
   reactions: UnknownAction[]
}

export interface GraphTransformable extends Transformable {
   vertices: Record<VertexId, VertexData>
}

export interface VertexTransformable extends Transformable {
   vertexFields: Record<string, VertexFieldState>
}

export type GraphTransformation = (
   transformable$: Observable<GraphTransformable>
) => Observable<GraphTransformable>

export type VertexTransformation = (
   transformable$: Observable<VertexTransformable>
) => Observable<VertexTransformable>
