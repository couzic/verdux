import { Observable } from 'rxjs'
import { GraphSeed } from './GraphSeed'
import { GraphTransformable } from './GraphTransformable'

export type GraphPipeline = (
   seed$: Observable<GraphSeed>
) => Observable<GraphTransformable>
