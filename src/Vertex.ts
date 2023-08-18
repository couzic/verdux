import { AnyAction } from "@reduxjs/toolkit";
import { Observable } from "rxjs";
import { VertexInternalState } from "./VertexInternalState";
import { VertexState } from "./VertexState";
import { VertexType } from "./VertexType";

export interface Vertex<Type extends VertexType> {
  readonly name: string
  readonly id: symbol
  readonly currentState: {
    [K in keyof VertexState<Type>]: VertexState<Type>[K]
  }
  readonly state$: Observable<{
    [K in keyof VertexState<Type>]: VertexState<Type>[K]
  }>
  readonly currentInternalState: {
    [K in keyof VertexInternalState<Type>]: VertexInternalState<Type>[K]
  }
  readonly internalState$: Observable<{
    [K in keyof VertexInternalState<Type>]: VertexInternalState<Type>[K]
  }>
  dispatch(action: AnyAction): void
}
