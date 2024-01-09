import { UnknownAction } from '@reduxjs/toolkit'
import { VertexInstance } from './VertexInstance'
import { VertexType } from './VertexType'
import { VertexConfig } from './config/VertexConfig'

export interface Graph {
   getVertexInstance<Type extends VertexType>(
      vertexConfig: VertexConfig<Type>
   ): VertexInstance<Type>
   dispatch(action: UnknownAction): void
}
