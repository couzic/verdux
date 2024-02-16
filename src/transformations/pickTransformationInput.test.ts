import { expect } from 'chai'
import { Subject, map } from 'rxjs'
import { stub } from 'sinon'
import { VertexInternalState } from '../state/VertexInternalState'
import { InternalStateTransformation } from './InternalStateTransformation'
import { pickTransformationInput } from './pickTransformationInput'

describe(pickTransformationInput.name, () => {
   let transformationMapper: (
      internalState: VertexInternalState<any>
   ) => VertexInternalState<any>
   let transformation: InternalStateTransformation
   let input$: Subject<VertexInternalState<any>>
   let lastOutput: VertexInternalState<any>
   beforeEach(() => {
      transformationMapper = stub().callsFake(internalState => ({
         ...internalState,
         readonlyFields: {
            ...internalState.readonlyFields,
            nameLength: internalState.reduxState.vertex.name.length
         }
      }))
      transformation = dependencies => map(transformationMapper)
      const pickedTransformation = pickTransformationInput(
         ['name'],
         transformation
      )
      input$ = new Subject()
      pickedTransformation({})(input$).subscribe(output => {
         lastOutput = output
      })
   })
   it('initially has no output', () => {
      expect(lastOutput).to.be.undefined
   })
   describe('when first input received', () => {
      beforeEach(() => {
         input$.next({
            versions: {},
            reduxState: { vertex: { name: 'bob' }, downstream: {} },
            readonlyFields: {},
            loadableFields: {}
         })
      })
      it('computes output', () => {
         expect(transformationMapper).to.have.been.calledOnce
         expect(lastOutput).to.deep.equal({
            versions: {},
            reduxState: { vertex: { name: 'bob' }, downstream: {} },
            readonlyFields: { nameLength: 3 },
            loadableFields: {}
         })
      })
      describe('when second input with SAME values received', () => {
         beforeEach(() => {
            input$.next({
               versions: {},
               reduxState: { vertex: { name: 'bob' }, downstream: {} },
               readonlyFields: {},
               loadableFields: {}
            })
         })
         it('returns previously transformed output', () => {
            expect(transformationMapper).to.have.been.calledOnce
            expect(lastOutput).to.deep.equal({
               versions: {},
               reduxState: { vertex: { name: 'bob' }, downstream: {} },
               readonlyFields: { nameLength: 3 },
               loadableFields: {}
            })
         })
      })
      describe('when second input with DIFFERENT values received', () => {
         beforeEach(() => {
            input$.next({
               versions: {},
               reduxState: { vertex: { name: 'john' }, downstream: {} },
               readonlyFields: {},
               loadableFields: {}
            })
         })
         it('transforms output', () => {
            expect(transformationMapper).to.have.been.calledTwice
            expect(lastOutput).to.deep.equal({
               versions: {},
               reduxState: { vertex: { name: 'john' }, downstream: {} },
               readonlyFields: { nameLength: 4 },
               loadableFields: {}
            })
         })
      })
   })
})
