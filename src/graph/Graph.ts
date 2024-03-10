import { UnknownAction } from '@reduxjs/toolkit'
import { VertexConfig } from '../config/VertexConfig'
import { VertexInstance } from '../vertex/VertexInstance'
import { VertexType } from '../vertex/VertexType'

export interface Graph {
   getVertexInstance<Type extends VertexType>(
      vertexConfig: VertexConfig<Type>
   ): VertexInstance<Type>
   dispatch(action: UnknownAction): void
}
