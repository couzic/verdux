import { VertexFieldsDefinition } from '../config/VertexFieldsDefinition'
import { VertexFields } from '../run/VertexFields'
import { LazyVertexLoadableState } from '../state/LazyVertexLoadableState'

export class ReactionInput<
   Payload,
   Fields extends VertexFieldsDefinition
> extends LazyVertexLoadableState<Fields> {
   constructor(
      public readonly payload: Payload,
      public readonly dependencies: any,
      _fields: VertexFields
   ) {
      super(_fields)
   }
}
