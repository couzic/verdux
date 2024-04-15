import { VertexFieldsDefinition } from '../config/VertexFieldsDefinition'
import { VertexFields } from '../run/VertexFields'
import { LazyVertexLoadableState } from './LazyVertexLoadableState'

export class LazyVertexLoadableStateWithDependencies<
   Fields extends VertexFieldsDefinition
> extends LazyVertexLoadableState<Fields> {
   constructor(
      _fields: VertexFields,
      public readonly dependencies: any
   ) {
      super(_fields)
   }
}
