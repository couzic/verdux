import { AnyAction } from "redux";
import { Vertex } from "./Vertex";
import { VertexConfig } from "./VertexConfig";
import { VertexType } from "./VertexType";

export interface Graph {
  getInstance<Type extends VertexType>(vertexConfig: VertexConfig<Type>): Vertex<Type>
  dispatch(action: AnyAction): void
}