import { Slice } from "@reduxjs/toolkit";
import { ReducerWithInitialState } from "@reduxjs/toolkit/dist/createReducer";
import { Reducer } from "redux";
import { Observable, ReplaySubject, map } from "rxjs";
import { DownstreamVertexConfig } from "./DownstreamVertexConfig";
import { PickedLoadedVertexState } from "./PickedLoadedVertexState";
import { RootVertexConfig } from "./RootVertexConfig";
import { VertexConfig } from "./VertexConfig";
import { VertexInternalState } from "./VertexInternalState";
import { VertexStateKey } from "./VertexState";
import { VertexType } from "./VertexType";
import { fromInternalState } from "./fromInternalState";


export abstract class VertexConfigImpl<Type extends VertexType> implements VertexConfig<Type> {
  readonly id: symbol

  protected readonly internalStateTransformations: Array<(internalState$: Observable<VertexInternalState<any>>) => Observable<VertexInternalState<any>>> = []

  abstract readonly rootVertex: RootVertexConfig<any>

  constructor(
    public readonly name: string,
    public readonly getInitialState: () => Type["reduxState"],
    public readonly reducer: Reducer<Type['reduxState']>,
    public readonly upstreamVertex: VertexConfig<any> | undefined
  ) {
    this.id = Symbol(`Vertex ${name}`)
  }

  configureDownstreamVertex<ReduxState extends object, UpstreamField extends VertexStateKey<Type> = never, LoadableFields extends object = {}>(
    options: ({
      slice: Slice<ReduxState>,
    } | {
      name: string,
      reducer: ReducerWithInitialState<ReduxState>,
    }) & {
      upstreamFields?: UpstreamField[]
    }): any {
    const upstreamFields = options.upstreamFields || []
    const downstreamConfig = 'slice' in options
      ? new DownstreamVertexConfigImpl(options.slice.name, options.slice.getInitialState, options.slice.reducer as Reducer<any>, this as any, upstreamFields as any)
      : new DownstreamVertexConfigImpl(options.name, options.reducer.getInitialState, options.reducer as Reducer<any>, this as any, upstreamFields as any)
    return downstreamConfig
  }

  computeFromFields<
    K extends VertexStateKey<Type>,
    Computers extends Record<
      string,
      (pickedFields: { [PK in keyof PickedLoadedVertexState<Type, K>]: PickedLoadedVertexState<Type, K>[PK]; }) => any
    >
  >(
    fields: K[],
    computers: Computers
  ): any {
    this.internalStateTransformations.push(
      map((internalState: VertexInternalState<any>) => {
        // TODO make sure recomputing only occurs when picked fields change
        const state = fromInternalState(internalState)
        const picked: any = {}
        fields.forEach(field => picked[field] = state[field])

        const computedValues: any = {}
        const computedFields = Object.keys(computers)
        computedFields.forEach(computedField => {
          computedValues[computedField] = computers[computedField](picked) // TODO catch errors ?
        })
        return {
          ...internalState,
          readonlyFields: { ...internalState.readonlyFields, ...computedValues }
        }
      }))
    return this
  }
}

export class DownstreamVertexConfigImpl<Type extends VertexType> extends VertexConfigImpl<Type> implements DownstreamVertexConfig<Type>{

  get rootVertex() {
    return this.upstreamVertex!.rootVertex
  }

  constructor(
    name: string,
    getInitialState: () => Type["reduxState"],
    reducer: Reducer<Type['reduxState']>,
    upstreamVertex: VertexConfig<any>,
    private readonly upstreamFields: string[],
  ) {
    super(name, getInitialState, reducer, upstreamVertex)
  }

  createInternalStateStreamFromUpstream(upstreamInternalState$: Observable<VertexInternalState<any>>): any {
    const internalState$ = new ReplaySubject<VertexInternalState<any>>(1)
    const originalInternalState$ = upstreamInternalState$.pipe(
      map((upstream) => {
        const reduxState = upstream.reduxState.downstream[this.name]
        const readonlyFields: any = {}
        this.upstreamFields.forEach(field => {
          // TODO Define priorities between reduxState, readonlyFields and loadableFields
          // TODO Print warning / throw Error when field on more than one of upstream reduxState/readonlyFields/loadableFields
          if (field in upstream.reduxState.vertex) {
            readonlyFields[field] = upstream.reduxState.vertex[field]
          } else if (field in upstream.readonlyFields) {
            readonlyFields[field] = upstream.readonlyFields[field]
          }
          // TODO handle case when field is loadable fields
        })
        return {
          status: 'loaded',
          errors: [],
          reduxState,
          readonlyFields,
          loadableFields: {} as any // TODO
        } as VertexInternalState<any>
      }))
    this.internalStateTransformations
      .reduce((observable, transformation) => transformation(observable), originalInternalState$)
      .subscribe(internalState$)
    return internalState$
  }
}