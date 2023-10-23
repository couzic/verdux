import { expect } from 'chai'
import { Observable, Subject, map } from 'rxjs'
import { stub } from 'sinon'
import { InjectedTransformation } from '../transformations/InternalStateTransformation'
import { VertexInternalState } from './VertexInternalState'
import { incomingToOutgoingInternalStateStream } from './incomingToOutgoingInternalStateStream'

describe(incomingToOutgoingInternalStateStream.name, () => {
   const upstreamVertexId = Symbol('upstreamVertexId')
   const vertexId = Symbol('vertexId')
   describe('no transformations', () => {
      let incomingInternalState$: Subject<VertexInternalState<any>>
      let outgoingInternalState$: Observable<VertexInternalState<any>>
      let lastOutgoingInternalState: VertexInternalState<any>
      beforeEach(() => {
         incomingInternalState$ = new Subject()
         outgoingInternalState$ = incomingToOutgoingInternalStateStream(
            vertexId,
            incomingInternalState$,
            []
         )
         outgoingInternalState$.subscribe(_ => (lastOutgoingInternalState = _))
      })
      it('initially has no outgoing state', () => {
         expect(lastOutgoingInternalState).to.be.undefined
      })
      describe('when first incoming state emitted', () => {
         beforeEach(() => {
            incomingInternalState$.next({
               versions: { [upstreamVertexId]: 1 },
               reduxState: { vertex: {}, downstream: {} },
               readonlyFields: {},
               loadableFields: {}
            })
         })
         it('emits outgoing internal state', () => {
            expect(lastOutgoingInternalState).to.deep.equal({
               versions: { [upstreamVertexId]: 1, [vertexId]: 1 },
               reduxState: { vertex: {}, downstream: {} },
               readonlyFields: {},
               loadableFields: {}
            })
         })
         describe('when second UNCHANGED incoming state emitted', () => {
            beforeEach(() => {
               incomingInternalState$.next({
                  versions: { [upstreamVertexId]: 2 },
                  reduxState: { vertex: {}, downstream: {} },
                  readonlyFields: {},
                  loadableFields: {}
               })
            })
            it('emits from memory', () => {
               expect(lastOutgoingInternalState).to.deep.equal({
                  versions: { [upstreamVertexId]: 2, [vertexId]: 1 },
                  reduxState: { vertex: {}, downstream: {} },
                  readonlyFields: {},
                  loadableFields: {}
               })
            })
         })
         describe('when second CHANGED incoming state emitted', () => {
            beforeEach(() => {
               incomingInternalState$.next({
                  versions: { [upstreamVertexId]: 2 },
                  reduxState: { vertex: {}, downstream: {} },
                  readonlyFields: { foo: 'bar' },
                  loadableFields: {}
               })
            })
            it('emits new outgoing internal state', () => {
               expect(lastOutgoingInternalState).to.deep.equal({
                  versions: { [upstreamVertexId]: 2, [vertexId]: 2 },
                  reduxState: { vertex: {}, downstream: {} },
                  readonlyFields: { foo: 'bar' },
                  loadableFields: {}
               })
            })
         })
      })
   })
   describe('with transformations', () => {
      let incomingInternalState$: Subject<VertexInternalState<any>>
      let outgoingInternalState$: Observable<VertexInternalState<any>>
      let lastOutgoingInternalState: VertexInternalState<any>
      let fetchName: () => string
      let transformations: InjectedTransformation[]
      beforeEach(() => {
         incomingInternalState$ = new Subject()
         fetchName = stub().returns('name')
         transformations = [
            map(internalState => ({
               ...internalState,
               readonlyFields: {
                  ...internalState.readonlyFields,
                  name: fetchName()
               }
            }))
         ]
         outgoingInternalState$ = incomingToOutgoingInternalStateStream(
            vertexId,
            incomingInternalState$,
            transformations
         )
         outgoingInternalState$.subscribe(_ => (lastOutgoingInternalState = _))
      })
      it('initially has no outgoing state', () => {
         expect(lastOutgoingInternalState).to.be.undefined
      })
      describe('when first incoming state emitted', () => {
         beforeEach(() => {
            incomingInternalState$.next({
               versions: { [upstreamVertexId]: 1 },
               reduxState: { vertex: { foo: 'bar' }, downstream: {} },
               readonlyFields: {},
               loadableFields: {}
            })
         })
         it('emits outgoing internal state', () => {
            expect(lastOutgoingInternalState).to.deep.equal({
               versions: { [upstreamVertexId]: 1, [vertexId]: 1 },
               reduxState: { vertex: { foo: 'bar' }, downstream: {} },
               readonlyFields: { name: 'name' },
               loadableFields: {}
            })
         })
         it('calls transformer', () => {
            expect(fetchName).to.have.been.calledOnce
         })
         describe('when second incoming state emitted with same values but different upstream version', () => {
            beforeEach(() => {
               incomingInternalState$.next({
                  versions: { [upstreamVertexId]: 2 },
                  reduxState: { vertex: { foo: 'bar' }, downstream: {} },
                  readonlyFields: {},
                  loadableFields: {}
               })
            })
            it('does not call transformer', () => {
               expect(fetchName).to.have.been.calledOnce
            })
            it('emits from memory', () => {
               expect(lastOutgoingInternalState).to.deep.equal({
                  versions: { [upstreamVertexId]: 2, [vertexId]: 1 },
                  reduxState: { vertex: { foo: 'bar' }, downstream: {} },
                  readonlyFields: { name: 'name' },
                  loadableFields: {}
               })
            })
         })
         describe('when second incoming state emitted with different values', () => {
            beforeEach(() => {
               incomingInternalState$.next({
                  versions: { [upstreamVertexId]: 2 },
                  reduxState: { vertex: { foo: 'baz' }, downstream: {} },
                  readonlyFields: {},
                  loadableFields: {}
               })
            })
            it('calls transformer again', () => {
               expect(fetchName).to.have.been.calledTwice
            })
            it('emits new internal state', () => {
               expect(lastOutgoingInternalState).to.deep.equal({
                  versions: { [upstreamVertexId]: 2, [vertexId]: 2 },
                  reduxState: { vertex: { foo: 'baz' }, downstream: {} },
                  readonlyFields: { name: 'name' },
                  loadableFields: {}
               })
            })
         })
      })
   })
})
