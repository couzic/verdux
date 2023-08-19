import { Slice } from "@reduxjs/toolkit";
import { ReducerWithInitialState } from "@reduxjs/toolkit/dist/createReducer";
import { Reducer } from "redux";
import { Observable, ReplaySubject, catchError, combineLatest, distinctUntilChanged, filter, map, merge, mergeAll, of, scan, switchMap } from "rxjs";
import { DependencyProviders } from "./DependencyProviders";
import { PickedLoadedVertexState } from "./PickedLoadedVertexState";
import { VertexConfig } from "./VertexConfig";
import { VertexInternalState } from "./VertexInternalState";
import { VertexRuntimeConfig } from "./VertexRuntimeConfig";
import { VertexStateKey } from "./VertexState";
import { VertexType } from "./VertexType";
import { fromInternalState } from "./fromInternalState";
import { internalStateEquals } from './internalStateEquals';
import { isLoaded } from './isLoaded';
import { pickInternalState } from './pickInternalState';

export class VertexConfigImpl<Type extends VertexType> implements VertexConfig<Type> {
  readonly id: symbol

  protected readonly internalStateTransformations: Array<
    (dependencies: Type['dependencies']) => (internalState$: Observable<VertexInternalState<any>>) => Observable<VertexInternalState<any>>
  > = []

  get rootVertex(): VertexConfig<any> {
    if (this.inputRootVertex === null) return this as any
    return this.inputRootVertex
  }

  constructor(
    public readonly name: string,
    public readonly getInitialState: () => Type["reduxState"],
    public readonly reducer: Reducer<Type['reduxState']>,
    public readonly upstreamVertex: VertexConfig<any> | undefined,
    public readonly upstreamFields: string[],
    private readonly inputRootVertex: VertexConfig<any> | null,
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
      ? new VertexConfigImpl(options.slice.name, options.slice.getInitialState, options.slice.reducer as Reducer<any>, this as any, upstreamFields as any, this.rootVertex, options.dependencies || {})
      : new VertexConfigImpl(options.name, options.reducer.getInitialState, options.reducer as Reducer<any>, this as any, upstreamFields as any, this.rootVertex, options.dependencies || {})
    return downstreamConfig
  }

  applyInternalStateTransformations(internalState$: Observable<VertexInternalState<any>>, dependencies: Type['dependencies']) {
    return this.internalStateTransformations.reduce((observable, transformation) => transformation(dependencies)(observable), internalState$)
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