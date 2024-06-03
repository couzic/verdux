import { expect } from 'chai'
import { NEVER, Subject, from, of, tap } from 'rxjs'
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

// TODO when loader throws error
