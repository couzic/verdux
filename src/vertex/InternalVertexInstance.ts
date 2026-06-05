import { VertexFieldsDefinition } from '../config/VertexFieldsDefinition'
import { VertexChangedFields, VertexFields } from '../run/VertexFields'
import { VertexInstance } from './VertexInstance'

export interface InternalVertexInstance<
   Fields extends VertexFieldsDefinition,
   Dependencies extends Record<string, any>
> extends VertexInstance<Fields, Dependencies> {
   __pushFields(
      fields: VertexFields,
      changedFields: VertexChangedFields | undefined
   ): void
}
