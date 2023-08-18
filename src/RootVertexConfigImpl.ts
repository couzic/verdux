import { Reducer } from "@reduxjs/toolkit"
import { Observable, ReplaySubject, map } from "rxjs"
import { RootVertexConfig } from "./RootVertexConfig"
import { VertexConfigImpl } from "./VertexConfigImpl"
import { VertexInternalState } from './VertexInternalState'
import { VertexType } from './VertexType'

export class RootVertexConfigImpl<Type extends VertexType> extends VertexConfigImpl<Type> implements RootVertexConfig<Type>{

  get rootVertex() { return this as any }

  constructor(
    name: string,
    getInitialState: () => Type["reduxState"],
    reducer: Reducer<Type['reduxState']>
  ) {
    super(name, getInitialState, reducer, undefined)
  }

  createInternalStateStreamFromRedux(reduxState$: Observable<any>): any {
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
      .reduce((observable, transformation) => transformation(observable), originalInternalState$)
      .subscribe(internalState$)
    return internalState$
  }

}