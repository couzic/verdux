import { AnyAction } from 'redux'
import { VertexConfig } from './VertexConfig'
import { VertexInstance } from './VertexInstance'
import { VertexType } from './VertexType'

export interface Graph {
   getVertexInstance<Type extends VertexType>(
      vertexConfig: VertexConfig<Type>
   ): VertexInstance<Type>
   dispatch(action: AnyAction): void
}
