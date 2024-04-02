import { expect } from 'chai'
import { Subject, of, tap } from 'rxjs'
import { VertexRunData } from '../run/RunData'
import { loadFromFields } from './loadFromFields'

const createRunData = (fields: Record<string, any>): VertexRunData => {
   const changedFields: Record<string, true> = {}
   Object.keys(fields).forEach(fieldName => {
      changedFields[fieldName] = true
   })
   return {
      action: undefined,
      fields,
      changedFields,
      fieldsReactions: [],
      reactions: []
   }
}

describe(loadFromFields.name, () => {
   it('loads from picked field', () => {
      const inputData = createRunData({
         name: {
            status: 'loaded',
            value: 'John',
            errors: []
         },
         irrelevant: {
            status: 'loaded',
            value: 'whatever',
            errors: []
         }
      })
      loadFromFields(['name'], {
         uppercaseName: (state: any) => {
            expect(state).to.deep.equal({ name: 'John' })
            return of(state.name.toUpperCase())
         }
      })(of(inputData)).subscribe()
   })
   describe('when loading two values from single loaded field', () => {
      let inputData$: Subject<VertexRunData>
      let latestInputData: VertexRunData
      let receivedLowercaseName$: Subject<string>
      let receivedUppercaseName$: Subject<string>
      let latestOutputData: VertexRunData | undefined = undefined
      let outputDataEmissions: number
      let callsToLowercaseLoader: number
      let callsToUppercaseLoader: number
      beforeEach(() => {
         outputDataEmissions = 0
         callsToLowercaseLoader = 0
         callsToUppercaseLoader = 0
         inputData$ = new Subject()
         receivedLowercaseName$ = new Subject()
         receivedUppercaseName$ = new Subject()
         const outputData$ = loadFromFields(['name'], {
            lowercaseName: () => {
               callsToLowercaseLoader++
               return receivedLowercaseName$
            },
            uppercaseName: () => {
               callsToUppercaseLoader++
               return receivedUppercaseName$
            }
         })(inputData$.pipe(tap(data => (latestInputData = data))))
         outputData$.subscribe(outputData => {
            outputDataEmissions++
            latestOutputData = outputData
         })
      })
      it('initially emits no output', () => {
         expect(latestOutputData).to.be.undefined
      })
      describe('when input field is loaded', () => {
         beforeEach(() => {
            inputData$.next(
               createRunData({
                  name: {
                     status: 'loaded',
                     value: 'John',
                     errors: []
                  },
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
               lowercaseName: {
                  status: 'loading',
                  value: undefined,
                  errors: []
               },
               uppercaseName: {
                  status: 'loading',
                  value: undefined,
                  errors: []
               }
            })
            expect(latestOutputData?.changedFields).to.deep.equal({
               ...latestInputData.changedFields,
               lowercaseName: true,
               uppercaseName: true
            })
         })
         describe('when first loaded value is received', () => {
            beforeEach(() => {
               receivedLowercaseName$.next('john')
            })
            it('has loaded output field', () => {
               expect(latestOutputData?.fields).to.deep.equal({
                  ...latestInputData.fields,
                  lowercaseName: {
                     status: 'loaded',
                     value: 'john',
                     errors: []
                  },
                  uppercaseName: {
                     status: 'loading',
                     value: undefined,
                     errors: []
                  }
               })
               expect(latestOutputData?.changedFields).to.deep.equal({
                  lowercaseName: true
               })
            })
            describe('when second loaded value is received', () => {
               beforeEach(() => {
                  receivedUppercaseName$.next('JOHN')
               })
               it('has loaded output field', () => {
                  expect(latestOutputData?.fields).to.deep.equal({
                     ...latestInputData.fields,
                     lowercaseName: {
                        status: 'loaded',
                        value: 'john',
                        errors: []
                     },
                     uppercaseName: {
                        status: 'loaded',
                        value: 'JOHN',
                        errors: []
                     }
                  })
                  expect(latestOutputData?.changedFields).to.deep.equal({
                     uppercaseName: true
                  })
               })
            })
         })
      })
      describe('when input field is LOADING', () => {
         const firstInputData = createRunData({
            name: {
               status: 'loading',
               value: undefined,
               errors: []
            },
            irrelevant: {
               status: 'loaded',
               value: 'whatever',
               errors: []
            }
         })
         beforeEach(() => {
            inputData$.next(firstInputData)
         })
         it('has loading output fields', () => {
            expect(latestOutputData?.fields).to.deep.equal({
               ...latestInputData.fields,
               lowercaseName: {
                  status: 'loading',
                  value: undefined,
                  errors: []
               },
               uppercaseName: {
                  status: 'loading',
                  value: undefined,
                  errors: []
               }
            })
            expect(latestOutputData?.changedFields).to.deep.equal({
               ...latestInputData.changedFields,
               lowercaseName: true,
               uppercaseName: true
            })
         })
         it('does not call loaders', () => {
            expect(callsToLowercaseLoader).to.equal(0)
            expect(callsToUppercaseLoader).to.equal(0)
         })
         describe('when input fields becomes LOADED', () => {
            const secondInputData: VertexRunData = {
               ...firstInputData,
               fields: {
                  ...firstInputData.fields,
                  name: {
                     status: 'loaded',
                     value: 'John',
                     errors: []
                  }
               },
               changedFields: {
                  name: true
               }
            }
            beforeEach(() => inputData$.next(secondInputData))
            it('still has loading output fields', () => {
               expect(latestOutputData?.fields).to.deep.equal({
                  ...latestInputData.fields,
                  lowercaseName: {
                     status: 'loading',
                     value: undefined,
                     errors: []
                  },
                  uppercaseName: {
                     status: 'loading',
                     value: undefined,
                     errors: []
                  }
               })
               expect(latestOutputData?.changedFields).to.deep.equal({
                  name: true
               })
            })
            describe('when another irrelevant field changes', () => {
               beforeEach(() => {
                  inputData$.next({
                     ...secondInputData,
                     fields: {
                        ...latestOutputData!.fields,
                        irrelevant: {
                           status: 'loaded',
                           value: 'something else',
                           errors: []
                        }
                     },
                     changedFields: {
                        irrelevant: true
                     }
                  })
               })
               it('does not call loaders again', () => {
                  expect(callsToLowercaseLoader).to.equal(1)
                  expect(callsToUppercaseLoader).to.equal(1)
                  expect(outputDataEmissions).to.equal(3)
               })
            })
         })
      })
   })
})

// TODO when input field is in error
// TODO when loader throws error
