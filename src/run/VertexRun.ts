import { Observable } from 'rxjs'
import { VertexRunData } from './RunData'

export type VertexRun = (
   data$: Observable<VertexRunData>
) => Observable<VertexRunData>
