import { VertexType } from "./VertexType";

// TODO prevent key clashes between loadable & (updatable & readonly) both compile and run time
export type VertexInternalState<Type extends VertexType> = {
  status: 'loading',
  errors: []
  reduxState: { vertex: Type['reduxState'], downstream: Record<string, any> }
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
  reduxState: { vertex: Type['reduxState'], downstream: Record<string, any> }
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
  reduxState: { vertex: Type['reduxState'], downstream: Record<string, any> }
  readonlyFields: Type['readonlyFields']
  loadableFields: {
    [K in keyof Type['loadableFields']]: {
      status: 'loaded'
      value: Type['loadableFields'][K]
      error: undefined
    }
  }
}


