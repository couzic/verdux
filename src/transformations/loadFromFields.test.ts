import { expect } from 'chai'
import { Observable, Subject } from 'rxjs'
import { stub } from 'sinon'
import { Dependable } from '../config/Dependable'
import { VertexInternalState } from '../state/VertexInternalState'
import { loadFromFieldsTransformation } from './loadFromFields'

describe(loadFromFieldsTransformation.name, () => {
   describe('simple incoming internal state', () => {
      const fields: string[] = ['name']
      let uppercaseNameLoader: (state: any) => Observable<string>
      let loaders: Dependable<
         any,
         Record<string, (state: any) => Observable<any>>
      >
      let input$: Subject<VertexInternalState<any>>
      let loadedUppercaseName$: Subject<string>
      let output$: Observable<VertexInternalState<any>>
      let lastOutput: VertexInternalState<any>
      beforeEach(() => {
         input$ = new Subject()
         loadedUppercaseName$ = new Subject()
         uppercaseNameLoader = stub().returns(loadedUppercaseName$)
         loaders = () => ({
            uppercaseName: uppercaseNameLoader
         })
         output$ = loadFromFieldsTransformation(fields, loaders)({})(input$)
         output$.subscribe(_ => (lastOutput = _))
      })
      it('initially has no outgoing state', () => {
         expect(uppercaseNameLoader).not.to.have.been.called
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
         it('loads uppercase name', () => {
            expect(uppercaseNameLoader).to.have.been.calledOnce
            expect(lastOutput).to.deep.equal({
               versions: {},
               reduxState: { vertex: { name: 'bob' }, downstream: {} },
               readonlyFields: {},
               loadableFields: {
                  uppercaseName: {
                     error: undefined,
                     status: 'loading',
                     value: undefined
                  }
               }
            })
         })
         describe('when uppercase name loaded', () => {
            beforeEach(() => {
               loadedUppercaseName$.next('BOB')
            })
            it('returns loaded value', () => {
               expect(lastOutput).to.deep.equal({
                  versions: {},
                  reduxState: { vertex: { name: 'bob' }, downstream: {} },
                  readonlyFields: {},
                  loadableFields: {
                     uppercaseName: {
                        error: undefined,
                        status: 'loaded',
                        value: 'BOB'
                     }
                  }
               })
            })
            describe('when second incoming state emitted with different downstream values', () => {
               beforeEach(() => {
                  input$.next({
                     versions: {},
                     reduxState: {
                        vertex: { name: 'bob' },
                        downstream: { irrelevant: 'to be ignored' }
                     },
                     readonlyFields: {},
                     loadableFields: {}
                  })
               })
               it('does NOT call loader again', () => {
                  expect(uppercaseNameLoader).to.have.been.calledOnce
                  expect(lastOutput).to.deep.equal({
                     versions: {},
                     reduxState: {
                        vertex: { name: 'bob' },
                        downstream: { irrelevant: 'to be ignored' }
                     },
                     readonlyFields: {},
                     loadableFields: {
                        uppercaseName: {
                           error: undefined,
                           status: 'loaded',
                           value: 'BOB'
                        }
                     }
                  })
               })
            })
         })
      })
   })
})
