import { Match } from '../util/Match'
import { VertexFieldsDefinition } from './VertexFieldsDefinition'

export type HasLoadable<Fields extends VertexFieldsDefinition> = Match<
   Fields,
   Record<
      string,
      {
         loadable: true
         value: any
      }
   >
>
