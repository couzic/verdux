import { expect } from 'chai'
import { Observable, Subject } from 'rxjs'
import { stub } from 'sinon'
import { Dependable } from '../config/Dependable'
import { VertexInternalState } from '../state/VertexInternalState'
import { computeFromFieldsTransformation } from './computeFromFields'

describe(computeFromFieldsTransformation.name, () => {
   describe('simple incoming internal state', () => {
      const fields: string[] = ['name']
      let uppercaseNameComputer: (state: any) => string
      let computers: Dependable<any, Record<string, (state: any) => any>>
      let input$: Subject<VertexInternalState<any>>
      let output$: Observable<VertexInternalState<any>>
      let lastOutput: VertexInternalState<any>
      beforeEach(() => {
         input$ = new Subject()
         uppercaseNameComputer = stub().callsFake(state =>
            state.name.toUpperCase()
         )
         computers = () => ({
            uppercaseName: uppercaseNameComputer
         })
         output$ = computeFromFieldsTransformation(fields, computers)({})(
            input$
         )
         output$.subscribe(_ => (lastOutput = _))
      })
      it('initially has no outgoing state', () => {
         expect(uppercaseNameComputer).not.to.have.been.called
         expect(lastOutput).to.be.undefined
      })
      describe('when first incoming state emitted', () => {
         beforeEach(() => {
            input$.next({
               versions: {},
               reduxState: { vertex: { name: 'bob' }, downstream: {} },
               readonlyFields: {},
               loadableFields: {}
            })
         })
         it('computes value', () => {
            expect(uppercaseNameComputer).to.have.been.calledOnce
            expect(lastOutput).to.deep.equal({
               versions: {},
               reduxState: { vertex: { name: 'bob' }, downstream: {} },
               readonlyFields: { uppercaseName: 'BOB' },
               loadableFields: {}
            })
         })
         describe('when second incoming state emitted, SAME values', () => {
            beforeEach(() => {
               input$.next({
                  versions: {},
                  reduxState: { vertex: { name: 'bob' }, downstream: {} },
                  readonlyFields: {},
                  loadableFields: {}
               })
            })
            it('returns previously computed value', () => {
               expect(uppercaseNameComputer).to.have.been.calledOnce
               expect(lastOutput).to.deep.equal({
                  versions: {},
                  reduxState: { vertex: { name: 'bob' }, downstream: {} },
                  readonlyFields: { uppercaseName: 'BOB' },
                  loadableFields: {}
               })
            })
         })
      })
   })
})
