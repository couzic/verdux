import { Observable, ReplaySubject } from "rxjs";
import { VertexConfig } from "./VertexConfig";
import { VertexInternalState } from "./VertexInternalState";
import { VertexType } from "./VertexType";

export interface DownstreamVertexConfig<Type extends VertexType> extends VertexConfig<Type> {
  createInternalStateStreamFromUpstream(upstreamInternalState$: Observable<VertexInternalState<any>>): ReplaySubject<VertexInternalState<Type>>
}
