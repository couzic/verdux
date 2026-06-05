import { createSlice } from '@reduxjs/toolkit'
import { expect } from 'chai'
import { NEVER, Subject, from, of, tap } from 'rxjs'
import { configureRootVertex } from '../config/configureRootVertex'
import { createGraph } from '../graph/createGraph'
import { VertexRunData } from '../run/RunData'
import { load } from './load'

const createInitialRunData = (fields: Record<string, any>): VertexRunData => {
   const changedFields: Record<string, true> = {}
   Object.keys(fields).forEach(fieldName => {
      changedFields[fieldName] = true
   })
   return {
      action: undefined,
      fields,
      changedFields,
      fieldsReactions: [],
      reactions: [],
      sideEffects: [],
      initialRun: true
   }
}

describe(load.name, () => {
   it('handles immediately emitting loader, should wait for input data to be emitted before anything', () => {
      const outputData$ = load({
         immediatelyLoaded: of('loaded NOW !!!')
      })(NEVER)
      let latestOutputData: VertexRunData | undefined = undefined
      outputData$.subscribe(outputData => {
         latestOutputData = outputData
      })
      expect(latestOutputData).to.be.undefined
   })
   describe('loading two values', () => {
      let inputData$: Subject<VertexRunData>
      let latestInputData: VertexRunData
      let receivedFirstValue$: Subject<string>
      let receivedSecondValue$: Subject<string>
      let latestOutputData: VertexRunData | undefined = undefined
      let outputDataEmissions: number
      beforeEach(() => {
         outputDataEmissions = 0
         inputData$ = new Subject()
         receivedFirstValue$ = new Subject()
         receivedSecondValue$ = new Subject()
         const outputData$ = load({
            firstValue: receivedFirstValue$,
            secondValue: receivedSecondValue$
         })(inputData$.pipe(tap(data => (latestInputData = data))))
         outputData$.subscribe(outputData => {
            outputDataEmissions++
            latestOutputData = outputData
         })
      })
      it('initially emits no output', () => {
         expect(latestOutputData).to.be.undefined
      })
      describe('when input data is emitted', () => {
         beforeEach(() => {
            inputData$.next(
               createInitialRunData({
                  irrelevant: {
                     status: 'loading',
                     value: undefined,
                     errors: []
                  }
               })
            )
         })
         it('has loading output fields', () => {
            expect(latestOutputData?.fields).to.deep.equal({
               ...latestInputData.fields,
               firstValue: {
                  status: 'loading',
                  value: undefined,
                  errors: []
               },
               secondValue: {
                  status: 'loading',
                  value: undefined,
                  errors: []
               }
            })
            expect(latestOutputData?.changedFields).to.deep.equal({
               ...latestInputData.changedFields,
               firstValue: true,
               secondValue: true
            })
         })
         describe('when first loaded value is received', () => {
            beforeEach(() => {
               receivedFirstValue$.next('First value')
            })
            it('has loaded output field', () => {
               expect(latestOutputData?.fields).to.deep.equal({
                  ...latestInputData.fields,
                  firstValue: {
                     status: 'loaded',
                     value: 'First value',
                     errors: []
                  },
                  secondValue: {
                     status: 'loading',
                     value: undefined,
                     errors: []
                  }
               })
               expect(latestOutputData?.changedFields).to.deep.equal({
                  firstValue: true
               })
            })
            describe('when irrelevant field changes', () => {
               beforeEach(() => {
                  inputData$.next({
                     ...latestInputData,
                     initialRun: false,
                     fields: {
                        irrelevant: {
                           status: 'loaded',
                           value: 'Whatever',
                           errors: []
                        }
                     }
                  })
               })
               it('does not load first value again', () => {
                  expect(outputDataEmissions).to.equal(3)
                  expect(latestOutputData?.fields).to.deep.equal({
                     ...latestInputData.fields,
                     firstValue: {
                        status: 'loaded',
                        value: 'First value',
                        errors: []
                     },
                     secondValue: {
                        status: 'loading',
                        value: undefined,
                        errors: []
                     }
                  })
                  expect(latestOutputData?.changedFields).to.deep.equal({
                     irrelevant: true
                  })
               })
            })
            describe('when second loaded value is received', () => {
               beforeEach(() => {
                  receivedSecondValue$.next('Second value')
               })
               it('has loaded output field', () => {
                  expect(latestOutputData?.fields).to.deep.equal({
                     ...latestInputData.fields,
                     firstValue: {
                        status: 'loaded',
                        value: 'First value',
                        errors: []
                     },
                     secondValue: {
                        status: 'loaded',
                        value: 'Second value',
                        errors: []
                     }
                  })
                  expect(latestOutputData?.changedFields).to.deep.equal({
                     secondValue: true
                  })
               })
               describe('when irrelevant field changes', () => {
                  beforeEach(() => {
                     inputData$.next({
                        ...latestInputData,
                        initialRun: false,
                        fields: {
                           irrelevant: {
                              status: 'loaded',
                              value: 'Whatever',
                              errors: []
                           }
                        }
                     })
                  })
                  it('does not load values again', () => {
                     expect(outputDataEmissions).to.equal(4)
                     expect(latestOutputData?.fields).to.deep.equal({
                        ...latestInputData.fields,
                        firstValue: {
                           status: 'loaded',
                           value: 'First value',
                           errors: []
                        },
                        secondValue: {
                           status: 'loaded',
                           value: 'Second value',
                           errors: []
                        }
                     })
                     expect(latestOutputData?.changedFields).to.deep.equal({
                        irrelevant: true
                     })
                  })
               })
            })
         })
      })
   })
})

// A loader re-emitting a reference-identical value must NOT flag its field
// changed: an unchanged value is a no-op, so change-gated reads (`pick`) do not
// re-fire and downstream subgraphs do not re-run. A genuine change (a new
// reference) must still propagate. Asserted full-graph through the public `pick`.
describe('load() change detection on re-emission (full graph)', () => {
   it('skips the no-op re-emit but still propagates a real change', () => {
      const obj = { n: 1 }
      const other = { n: 2 }
      const data$ = new Subject<{ n: number }>()
      const root = configureRootVertex({
         slice: createSlice({ name: 'root', initialState: {}, reducers: {} })
      }).load({ data: data$ })
      const graph = createGraph({ vertices: [root] })
      const vertex = graph.getVertexInstance(root)

      const picked: any[] = []
      vertex.pick(['data']).subscribe(_ => picked.push(_.fields.data))

      data$.next(obj) // loading -> loaded(obj)
      data$.next(obj) // identical reference: must be a no-op
      data$.next(other) // genuine change: must propagate

      expect(picked).to.deep.equal([
         { status: 'loading', value: undefined, errors: [] },
         { status: 'loaded', value: obj, errors: [] },
         { status: 'loaded', value: other, errors: [] }
      ])
   })
})
