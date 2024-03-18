import { UnknownAction } from '@reduxjs/toolkit'
import { VertexConfig } from '../config/VertexConfig'
import { VertexFieldsDefinition } from '../config/VertexFieldsDefinition'
import { VertexInstance } from '../vertex/VertexInstance'

export interface Graph {
   getVertexInstance<
      Fields extends VertexFieldsDefinition,
      Dependencies extends Record<string, any>
   >(
      vertexConfig: VertexConfig<Fields, Dependencies>
   ): VertexInstance<Fields, Dependencies>
   dispatch(action: UnknownAction): void
}
