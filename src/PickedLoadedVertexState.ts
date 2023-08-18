import { VertexStateKey } from "./VertexState";
import { VertexType } from "./VertexType";

export type PickedLoadedVertexState<
   Type extends VertexType,
   PickedKey extends VertexStateKey<Type>
> = {
      [K in PickedKey]: K extends keyof Type['loadableFields']
      ? Type['loadableFields'][K]
      : K extends keyof Type['readonlyFields']
      ? Type['readonlyFields'][K]
      : K extends keyof Type['reduxState']
      ? Type['reduxState'][K]
      : never
   }
