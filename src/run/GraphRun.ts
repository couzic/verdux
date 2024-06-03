import { Observable } from 'rxjs'
import { GraphRunData } from './RunData'

export type GraphRun = (
   data$: Observable<GraphRunData>
) => Observable<GraphRunData>
