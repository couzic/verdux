import { expect } from 'chai'
import { Observable, Subject } from 'rxjs'
import { VertexInternalState } from './VertexInternalState'
import { incomingFromMultipleUpstreamInternalStates } from './incomingFromMultipleUpstreamInternalStates'

describe(incomingFromMultipleUpstreamInternalStates.name, () => {
   const rootVertexId = Symbol('rootVertexId')
   const firstUpstreamVertexId = Symbol('firstUpstreamVertexId')
   const secondUpstreamVertexId = Symbol('secondUpstreamVertexId')
   const vertexName = 'vertexUnderTest'
   let incomingInternalState$: Observable<VertexInternalState<any>>
   describe('when no upstream field is picked', () => {
      let lastCommonAncestorInternalState$: Subject<VertexInternalState<any>>
      let directAncestors: Array<{
         internalState$: Subject<VertexInternalState<any>>
         pickedFields: string[]
      }>
      let latestIncomingInternalState: VertexInternalState<any>
      beforeEach(() => {
         lastCommonAncestorInternalState$ = new Subject()
         directAncestors = [
            {
               internalState$: new Subject(),
               pickedFields: [
                  'pickedFromFirstDirectAncestor',
                  'readonlyFromFirstDirectAncestor',
                  'loadableFromFirstDirectAncestor'
               ]
            },
            {
               internalState$: new Subject(),
               pickedFields: [
                  'pickedFromSecondDirectAncestor',
                  'readonlyFromSecondDirectAncestor',
                  'loadableFromSecondDirectAncestor'
               ]
            }
         ]
         incomingInternalState$ = incomingFromMultipleUpstreamInternalStates(
            vertexName,
            lastCommonAncestorInternalState$,
            directAncestors
         )
         incomingInternalState$.subscribe(_ => {
            latestIncomingInternalState = _
         })
      })
      it('initially has no state', () => {
         expect(latestIncomingInternalState).to.be.undefined
      })
      describe('when root vertex emits first redux state', () => {
         beforeEach(() => {
            lastCommonAncestorInternalState$.next({
               versions: { [rootVertexId]: 1 },
               reduxState: {
                  vertex: {},
                  downstream: {
                     [vertexName]: { vertex: {}, downstream: {} }
                  }
               },
               readonlyFields: { readonlyFromRoot: 'fromRoot' },
               loadableFields: {
                  loadableFromRoot: {
                     status: 'loaded',
                     value: 'fromRoot',
                     error: undefined
                  }
               }
            })
         })
         it('still has no state', () => {
            expect(latestIncomingInternalState).to.be.undefined
         })
         describe('when first direct ancestor emits first redux state', () => {
            beforeEach(() => {
               directAncestors[0].internalState$.next({
                  versions: { [rootVertexId]: 1, [firstUpstreamVertexId]: 1 },
                  reduxState: {
                     vertex: { pickedFromFirstDirectAncestor: 'fromFirst' },
                     downstream: {}
                  },
                  readonlyFields: {
                     readonlyFromFirstDirectAncestor: 'fromFirst'
                  },
                  loadableFields: {
                     loadableFromFirstDirectAncestor: {
                        status: 'loaded',
                        value: 'fromFirst',
                        error: undefined
                     }
                  }
               })
            })
            it('still has no state', () => {
               expect(latestIncomingInternalState).to.be.undefined
            })
            describe('when second direct ancestor emits first redux state', () => {
               beforeEach(() => {
                  directAncestors[1].internalState$.next({
                     versions: {
                        [rootVertexId]: 1,
                        [secondUpstreamVertexId]: 1
                     },
                     reduxState: {
                        vertex: {
                           pickedFromSecondDirectAncestor: 'fromSecond'
                        },
                        downstream: {}
                     },
                     readonlyFields: {
                        readonlyFromSecondDirectAncestor: 'fromSecond'
                     },
                     loadableFields: {
                        loadableFromSecondDirectAncestor: {
                           status: 'loaded',
                           value: 'fromSecond',
                           error: undefined
                        }
                     }
                  })
               })
               it('emits the upstream state', () => {
                  expect(latestIncomingInternalState).to.deep.equal({
                     versions: {
                        [rootVertexId]: 1,
                        [firstUpstreamVertexId]: 1,
                        [secondUpstreamVertexId]: 1
                     },
                     reduxState: { vertex: {}, downstream: {} },
                     readonlyFields: {
                        pickedFromFirstDirectAncestor: 'fromFirst',
                        pickedFromSecondDirectAncestor: 'fromSecond',
                        readonlyFromFirstDirectAncestor: 'fromFirst',
                        readonlyFromSecondDirectAncestor: 'fromSecond'
                     },
                     loadableFields: {
                        loadableFromFirstDirectAncestor: {
                           status: 'loaded',
                           value: 'fromFirst',
                           error: undefined
                        },
                        loadableFromSecondDirectAncestor: {
                           status: 'loaded',
                           value: 'fromSecond',
                           error: undefined
                        }
                     }
                  })
               })
            })
         })
      })
   })
})
