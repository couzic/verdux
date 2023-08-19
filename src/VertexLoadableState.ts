import { VertexErrorState, VertexLoadedState, VertexState } from "./VertexState";
import { VertexType } from "./VertexType";

// TODO prevent key clashes between loadable & (updatable & readonly) both compile and run time
export type VertexLoadableState<Type extends VertexType> = {
   status: 'loading',
   errors: []
   state: VertexState<Type>
   reduxState: Type['reduxState']
   readonlyFields: Type['readonlyFields']
   loadableFields: {
      [K in keyof Type['loadableFields']]:
      | { status: 'loading'; value: undefined; error: undefined }
      | {
         status: 'loaded'
         value: Type['loadableFields'][K]
         error: undefined
      }
   }
} | {
   status: 'error'
   errors: Error[]
   state: VertexErrorState<Type>
   reduxState: Type['reduxState']
   readonlyFields: { [K in keyof Type['readonlyFields']]: Type['readonlyFields'] | Error }
   loadableFields: {
      [K in keyof Type['loadableFields']]:
      | { status: 'loading'; value: undefined; error: undefined }
      | { status: 'error'; value: undefined; error: Error }
      | {
         status: 'loaded'
         value: Type['loadableFields'][K]
         error: undefined
      }
   }
} | {
   status: 'loaded'
   errors: []
   state: VertexLoadedState<Type>
   reduxState: Type['reduxState']
   readonlyFields: Type['readonlyFields']
   loadableFields: {
      [K in keyof Type['loadableFields']]: {
         status: 'loaded'
         value: Type['loadableFields'][K]
         error: undefined
      }
   }
}


