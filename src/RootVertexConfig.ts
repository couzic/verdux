import { Observable, ReplaySubject } from "rxjs";
import { VertexConfig } from "./VertexConfig";
import { VertexInternalState } from "./VertexInternalState";
import { VertexType } from "./VertexType";

export interface RootVertexConfig<Type extends VertexType> extends VertexConfig<Type> {
  createInternalStateStreamFromRedux(reduxState$: Observable<any>): ReplaySubject<VertexInternalState<Type>>
}
