import { expect } from 'chai'
import { Observable, Subject } from 'rxjs'
import { VertexInternalState } from './VertexInternalState'
import { incomingFromSingleUpstreamInternalState } from './incomingFromSingleUpstreamInternalState'

describe(incomingFromSingleUpstreamInternalState.name, () => {
   const upstreamVertexId = Symbol('upstreamVertexId')
   const vertexName = 'vertexUnderTest'
   let incomingInternalState$: Observable<VertexInternalState<any>>
   describe('when no upstream field is picked', () => {
      let upstreamInternalState$: Subject<VertexInternalState<any>>
      let latestIncomingInternalState: VertexInternalState<any>
      beforeEach(() => {
         upstreamInternalState$ = new Subject()
         incomingInternalState$ = incomingFromSingleUpstreamInternalState(
            vertexName,
            [],
            upstreamInternalState$
         )
         incomingInternalState$.subscribe(_ => {
            latestIncomingInternalState = _
         })
      })
      it('initially has no state', () => {
         expect(latestIncomingInternalState).to.be.undefined
      })
      describe('when upstream vertex emits first redux state', () => {
         beforeEach(() => {
            upstreamInternalState$.next({
               versions: { [upstreamVertexId]: 1 },
               reduxState: {
                  vertex: {},
                  downstream: {
                     [vertexName]: { vertex: { foo: 'bar' }, downstream: {} }
                  }
               },
               readonlyFields: {},
               loadableFields: {}
            })
         })
         it('emits the upstream state', () => {
            expect(latestIncomingInternalState).to.deep.equal({
               versions: { [upstreamVertexId]: 1 },
               reduxState: { vertex: { foo: 'bar' }, downstream: {} },
               readonlyFields: {},
               loadableFields: {}
            })
         })
         describe('when new upstream internal state emitted with actual changes', () => {
            beforeEach(() => {
               upstreamInternalState$.next({
                  versions: { [upstreamVertexId]: 2 },
                  reduxState: {
                     vertex: {},
                     downstream: {
                        [vertexName]: { vertex: { foo: 'baz' }, downstream: {} }
                     }
                  },
                  readonlyFields: {},
                  loadableFields: {}
               })
            })
            it('emits the new upstream state', () => {
               expect(latestIncomingInternalState).to.deep.equal({
                  versions: { [upstreamVertexId]: 2 },
                  reduxState: { vertex: { foo: 'baz' }, downstream: {} },
                  readonlyFields: {},
                  loadableFields: {}
               })
            })
         })
      })
   })
   it('picks redux state field', () => {
      const upstreamInternalState$ = new Subject<VertexInternalState<any>>()
      let latestIncomingInternalState: VertexInternalState<any> | undefined =
         undefined
      incomingInternalState$ = incomingFromSingleUpstreamInternalState(
         vertexName,
         ['foo'],
         upstreamInternalState$
      )
      incomingInternalState$.subscribe(internalState => {
         latestIncomingInternalState = internalState
      })
      upstreamInternalState$.next({
         versions: { [upstreamVertexId]: 1 },
         reduxState: {
            vertex: { foo: 'bar' },
            downstream: {
               [vertexName]: { vertex: {}, downstream: {} }
            }
         },
         readonlyFields: {},
         loadableFields: {}
      })
      expect(latestIncomingInternalState).to.deep.equal({
         versions: { [upstreamVertexId]: 1 },
         reduxState: { vertex: {}, downstream: {} },
         readonlyFields: { foo: 'bar' },
         loadableFields: {}
      })
   })
   it('picks readonly fields', () => {
      const upstreamInternalState$ = new Subject<VertexInternalState<any>>()
      let latestIncomingInternalState: VertexInternalState<any> | undefined =
         undefined
      incomingInternalState$ = incomingFromSingleUpstreamInternalState(
         vertexName,
         ['foo'],
         upstreamInternalState$
      )
      incomingInternalState$.subscribe(internalState => {
         latestIncomingInternalState = internalState
      })
      upstreamInternalState$.next({
         versions: { [upstreamVertexId]: 1 },
         reduxState: {
            vertex: {},
            downstream: {
               [vertexName]: { vertex: {}, downstream: {} }
            }
         },
         readonlyFields: { foo: 'bar' },
         loadableFields: {}
      })
      expect(latestIncomingInternalState).to.deep.equal({
         versions: { [upstreamVertexId]: 1 },
         reduxState: { vertex: {}, downstream: {} },
         readonlyFields: { foo: 'bar' },
         loadableFields: {}
      })
   })
   it('picks loadable fields', () => {
      const upstreamInternalState$ = new Subject<VertexInternalState<any>>()
      let latestIncomingInternalState: VertexInternalState<any> | undefined =
         undefined
      incomingInternalState$ = incomingFromSingleUpstreamInternalState(
         vertexName,
         ['foo'],
         upstreamInternalState$
      )
      incomingInternalState$.subscribe(internalState => {
         latestIncomingInternalState = internalState
      })
      upstreamInternalState$.next({
         versions: { [upstreamVertexId]: 1 },
         reduxState: {
            vertex: {},
            downstream: {
               [vertexName]: { vertex: {}, downstream: {} }
            }
         },
         readonlyFields: {},
         loadableFields: {
            foo: { status: 'loading', value: undefined, error: undefined }
         }
      })
      expect(latestIncomingInternalState).to.deep.equal({
         versions: { [upstreamVertexId]: 1 },
         reduxState: { vertex: {}, downstream: {} },
         readonlyFields: {},
         loadableFields: {
            foo: { status: 'loading', value: undefined, error: undefined }
         }
      })
   })
})
