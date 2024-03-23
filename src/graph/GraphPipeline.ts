import { Observable } from 'rxjs'
import { GraphSeed } from './GraphSeed'
import { GraphTransformable } from './Transformable'

export type GraphPipeline = (
   seed$: Observable<GraphSeed>
) => Observable<GraphTransformable>
