import { Reducer } from "@reduxjs/toolkit"
import { Observable, ReplaySubject, map } from "rxjs"
import { RootVertexConfig } from "./RootVertexConfig"
import { VertexConfigImpl } from "./VertexConfigImpl"
import { VertexInternalState } from './VertexInternalState'
import { VertexType } from './VertexType'
import { DependencyProviders } from './DependencyProviders'

export class RootVertexConfigImpl<Type extends VertexType> extends VertexConfigImpl<Type> implements RootVertexConfig<Type>{

  get rootVertex() { return this as any }

  constructor(
    name: string,
    getInitialState: () => Type["reduxState"],
    reducer: Reducer<Type['reduxState']>,
    dependencyProviders: DependencyProviders<any>
  ) {
    super(name, getInitialState, reducer, undefined, dependencyProviders || {})
  }

  createInternalStateStreamFromRedux(reduxState$: Observable<any>, dependencies: Type['dependencies']): any {
    const internalState$ = new ReplaySubject<VertexInternalState<any>>(1)
    const originalInternalState$ = reduxState$.pipe(
      map((reduxState): VertexInternalState<any> => ({
        status: 'loaded',
        errors: [],
        reduxState,
        readonlyFields: {},
        loadableFields: {}
      }))
    )
    this.internalStateTransformations
      .reduce((observable, transformation) => transformation(dependencies)(observable), originalInternalState$)
      .subscribe(internalState$)
    return internalState$
  }

}