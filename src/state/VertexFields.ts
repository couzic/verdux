import { VertexFieldState } from './VertexFieldState'

export type VertexFields<Field extends string = string> = Record<
   Field,
   VertexFieldState
>
