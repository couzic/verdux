import { Slice } from "@reduxjs/toolkit";
import { ReducerWithInitialState } from "@reduxjs/toolkit/dist/createReducer";
import { Reducer } from "redux";
import { Observable, ReplaySubject, catchError, combineLatest, distinctUntilChanged, filter, map, merge, mergeAll, of, scan, switchMap, tap } from "rxjs";
import { DependencyProviders } from "./DependencyProviders";
import { DownstreamVertexConfig } from "./DownstreamVertexConfig";
import { PickedLoadedVertexState } from "./PickedLoadedVertexState";
import { RootVertexConfig } from "./RootVertexConfig";
import { VertexConfig } from "./VertexConfig";
import { VertexInternalState } from "./VertexInternalState";
import { VertexState, VertexStateKey } from "./VertexState";
import { VertexType } from "./VertexType";
import { fromInternalState } from "./fromInternalState";
import { VertexRuntimeConfig } from "./VertexRuntimeConfig";
import { pickInternalState } from './pickInternalState'
import { isLoaded } from './isLoaded'
import { internalStateEquals } from './internalStateEquals'

export abstract class VertexConfigImpl<Type extends VertexType> implements VertexConfig<Type> {
  readonly id: symbol

  protected readonly internalStateTransformations: Array<
    (dependencies: Type['dependencies']) => (internalState$: Observable<VertexInternalState<any>>) => Observable<VertexInternalState<any>>
  > = []

  abstract readonly rootVertex: RootVertexConfig<any>

  constructor(
    public readonly name: string,
    public readonly getInitialState: () => Type["reduxState"],
    public readonly reducer: Reducer<Type['reduxState']>,
    public readonly upstreamVertex: VertexConfig<any> | undefined,
    public readonly dependencyProviders: DependencyProviders
  ) {
    this.id = Symbol(`Vertex ${name}`)
  }

  configureDownstreamVertex<
    ReduxState extends object,
    UpstreamField extends VertexStateKey<Type> = never,
  >(options: ({
    slice: Slice<ReduxState>,
  } | {
    name: string,
    reducer: ReducerWithInitialState<ReduxState>,
  }) & {
    upstreamFields?: UpstreamField[],
    dependencies?: DependencyProviders<Type>
  }): any {
    const upstreamFields = options.upstreamFields || []
    const downstreamConfig = 'slice' in options
      ? new DownstreamVertexConfigImpl(options.slice.name, options.slice.getInitialState, options.slice.reducer as Reducer<any>, this as any, upstreamFields as any, options.dependencies || {})
      : new DownstreamVertexConfigImpl(options.name, options.reducer.getInitialState, options.reducer as Reducer<any>, this as any, upstreamFields as any, options.dependencies || {})
    return downstreamConfig
  }

  injectedWith(dependencies: Partial<Type['dependencies']>): VertexRuntimeConfig<Type> {
    return {
      config: this,
      dependencies
    }
  }

  computeFromFields<
    K extends VertexStateKey<Type>,
    Computers extends Record<
      string,
      (pickedFields: { [PK in keyof PickedLoadedVertexState<Type, K>]: PickedLoadedVertexState<Type, K>[PK]; }, dependencies: Type['dependencies']) => any
    >
  >(
    fields: K[],
    computers: Computers,
  ): any {
    this.internalStateTransformations.push(dependencies => map((internalState) => {
      // TODO make sure recomputing only occurs when picked fields change
      const state = fromInternalState(internalState)
      const picked: any = {}
      fields.forEach(field => picked[field] = state[field])

      const computedValues: any = {}
      const computedFields = Object.keys(computers)
      computedFields.forEach(computedField => {
        computedValues[computedField] = computers[computedField](picked, dependencies) // TODO catch errors ?
      })
      return {
        ...internalState,
        readonlyFields: { ...internalState.readonlyFields, ...computedValues } // TODO values computed from loadable fields go to loadable fields
      }
    }))
    return this
  }

  loadFromFields<K extends VertexStateKey<Type>, LoadableValues>(
    fields: K[],
    loaders: {
      [LVK in keyof LoadableValues]: (fields: {
        [FK in K]: FK extends keyof Type['loadableFields']
        ? Type['loadableFields'][FK]
        : FK extends keyof Type['readonlyFields']
        ? Type['loadableFields'][FK]
        : FK extends keyof Type['reduxState']
        ? Type['reduxState'][FK]
        : never
      }, dependencies: Type['dependencies']) => Observable<LoadableValues[LVK]>
    }
  ): any {
    this.internalStateTransformations.push(dependencies => inputInternalState$ => {

      const loadableKeys = Object.keys(loaders) as (keyof LoadableValues)[]
      const loadingValues = {} as Record<keyof LoadableValues, any>
      loadableKeys.forEach(key => {
        loadingValues[key] = {
          status: 'loading',
          error: undefined,
          value: undefined
        }
      })

      const pickedInternalState$ = inputInternalState$.pipe(
        map(state => pickInternalState(state, fields)),
        distinctUntilChanged(internalStateEquals)
      )
      const loading$ = pickedInternalState$.pipe(map(() => loadingValues))

      const loadedOrError$ = pickedInternalState$.pipe(
        filter(isLoaded),
        map(fromInternalState),
        // TODO Logger
        // tap(data => this.context.dispatchLoading(this as any, data)), 
        switchMap((state) =>
          merge(
            loadableKeys.map(key =>
              loaders[key](state as any, dependencies).pipe(
                map(result => ({
                  [key]: {
                    status: 'loaded',
                    value: result,
                    error: undefined
                  }
                })),
                catchError((error: Error) =>
                  of({
                    [key]: { status: 'error', value: undefined, error }
                  })
                ) // TODO Recover from Error
              )
            )
          ).pipe(
            mergeAll(),
            scan((acc, loadableValues) => {
              return { ...acc, ...loadableValues } as any
            }, loadingValues)
          )
        ),
        // TODO Logger
        // tap(loadedValues =>
        //   this.context.dispatchLoaded(this as any, loadedValues)
        // )
      )
      const outputInternalState$ = new ReplaySubject<VertexInternalState<any>>(1)

      const outputLoadableFields$ = merge(loading$, loadedOrError$)

      combineLatest([inputInternalState$, outputLoadableFields$])
        .pipe(
          map(([inputInternalState, loadableFields]) => ({
            ...inputInternalState,
            loadableFields: { ...inputInternalState.loadableFields, ...loadableFields }
          }))
        )
        .subscribe(outputInternalState$)

      return outputInternalState$
    })
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
    dependencyProviders: Record<string, (dependencies: Type['dependencies']) => any>
  ) {
    super(name, getInitialState, reducer, upstreamVertex, dependencyProviders)
  }

  createInternalStateStreamFromUpstream(upstreamInternalState$: Observable<VertexInternalState<any>>, dependencies: Type['dependencies']): any {
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
      .reduce((observable, transformation) => transformation(dependencies)(observable), originalInternalState$)
      .subscribe(internalState$)
    return internalState$
  }
}