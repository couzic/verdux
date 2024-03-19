import { Observable } from 'rxjs'
import { GraphTransformable } from './GraphTransformable'

export type GraphTransformation = (
   transformable$: Observable<GraphTransformable>
) => Observable<GraphTransformable>
