import { VertexFieldsDefinition } from '../config/VertexFieldsDefinition'
import { VertexFields } from '../run/VertexFields'
import { VertexLoadableState } from './VertexLoadableState'
import { toVertexLoadableState } from './toVertexLoadableState'

export class LazyVertexLoadableState<Fields extends VertexFieldsDefinition>
   implements VertexLoadableState<Fields>
{
   private value: VertexLoadableState<Fields> | undefined = undefined

   constructor(private readonly _fields: VertexFields) {}

   private initializeValue() {
      if (this.value === undefined) {
         this.value = toVertexLoadableState(this._fields)
      }
   }

   get status() {
      this.initializeValue()
      return this.value!.status
   }

   get errors() {
      this.initializeValue()
      return this.value!.errors
   }

   get state() {
      this.initializeValue()
      return this.value!.state
   }

   get fields() {
      return this._fields as any
   }
}
