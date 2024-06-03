import { VertexFieldsDefinition } from '../config/VertexFieldsDefinition'
import { VertexFields } from '../run/VertexFields'
import { LazyVertexLoadableState } from '../state/LazyVertexLoadableState'

export class Reaction$Input<
   Payload,
   Fields extends VertexFieldsDefinition
> extends LazyVertexLoadableState<Fields> {
   constructor(
      public readonly payload: Payload,
      _fields: VertexFields
   ) {
      super(_fields)
   }
}
