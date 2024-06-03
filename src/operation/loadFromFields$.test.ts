import { expect } from 'chai'
import {
   NEVER,
   Observable,
   Subject,
   from,
   isObservable,
   map,
   of,
   tap
} from 'rxjs'
import { VertexRunData } from '../run/RunData'
import { loadFromFields$ } from './loadFromFields$'

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

describe(loadFromFields$.name, () => {
   it('loads from picked field', () => {
      const inputData = createInitialRunData({
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
      loadFromFields$(['name'], {
         uppercaseName: (fields$: Observable<{ name: string }>) => {
            expect(isObservable(fields$)).to.be.true
            fields$.subscribe(fields => {
               expect(fields).to.deep.equal({ name: 'John' })
            })
            return fields$.pipe(map(fields => fields.name.toUpperCase()))
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
      beforeEach(() => {
         outputDataEmissions = 0
         inputData$ = new Subject()
         receivedLowercaseName$ = new Subject()
         receivedUppercaseName$ = new Subject()
         const outputData$ = loadFromFields$(['name'], {
            lowercaseName: () => receivedLowercaseName$,
            uppercaseName: () => receivedUppercaseName$
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
               createInitialRunData({
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
            describe('when new input fields are received', () => {
               beforeEach(() => {
                  inputData$.next({
                     ...latestInputData,
                     initialRun: false,
                     fields: {
                        ...latestInputData.fields,
                        name: {
                           status: 'loaded',
                           value: 'Jane',
                           errors: []
                        }
                     },
                     changedFields: {
                        name: true
                     }
                  })
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
                     name: true,
                     lowercaseName: true
                  })
               })
            })
            describe('when second loaded value is received', () => {
               beforeEach(() => {
                  receivedUppercaseName$.next('JANE')
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
                        value: 'JANE',
                        errors: []
                     }
                  })
                  expect(latestOutputData?.changedFields).to.deep.equal({
                     uppercaseName: true
                  })
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
         const firstInputData = createInitialRunData({
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
               },
               initialRun: false
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
         })
      })
   })
   it('emits reactions once and only once', () => {
      const inputData: VertexRunData = {
         ...createInitialRunData({
            name: {
               status: 'loaded',
               value: 'John',
               errors: []
            }
         }),
         reactions: [{ type: 'a' }],
         fieldsReactions: [{ type: 'b' }]
      }
      let latestOutputData: VertexRunData | undefined = undefined
      let outputDataEmissions = 0
      loadFromFields$(['name'], {
         uppercaseName: (fields$: Observable<{ name: 'John' }>) =>
            fields$.pipe(map(fields => fields.name.toUpperCase()))
      })(of(inputData)).subscribe(outputData => {
         outputDataEmissions++
         latestOutputData = outputData
      })
      expect(outputDataEmissions).to.equal(2)
      expect(latestOutputData!.reactions).to.deep.equal([])
      expect(latestOutputData!.fieldsReactions).to.deep.equal([])
   })
   it('passes down irrelevant reactions', () => {
      const inputData = createInitialRunData({
         name: {
            status: 'loaded',
            value: 'John',
            errors: []
         }
      })
      let latestOutputData: VertexRunData | undefined = undefined
      let outputDataEmissions = 0
      loadFromFields$(['name'], {
         uppercaseName: (fields$: Observable<{ name: 'John' }>) =>
            fields$.pipe(map(fields => fields.name.toUpperCase()))
      })(
         from([
            inputData,
            {
               ...inputData,
               changedFields: {},
               reactions: [{ type: 'a' }],
               fieldsReactions: [{ type: 'b' }],
               initialRun: false
            }
         ])
      ).subscribe(outputData => {
         outputDataEmissions++
         latestOutputData = outputData
      })
      expect(outputDataEmissions).to.equal(3)
      expect(latestOutputData!.reactions).to.deep.equal([{ type: 'a' }])
      expect(latestOutputData!.fieldsReactions).to.deep.equal([{ type: 'b' }])
   })
   it('emits changed fields once and only once', () => {
      const inputData = createInitialRunData({
         name: {
            status: 'loaded',
            value: 'John',
            errors: []
         }
      })
      let latestOutputData: VertexRunData | undefined = undefined
      let outputDataEmissions = 0
      loadFromFields$(['name'], {
         uppercaseName: () => NEVER
      })(
         from([
            inputData,
            { ...inputData, changedFields: {}, initialRun: false }
         ])
      ).subscribe(outputData => {
         outputDataEmissions++
         latestOutputData = outputData
      })
      expect(outputDataEmissions).to.equal(2)
      expect(latestOutputData!.changedFields).to.deep.equal({})
   })
   it('passes down irrelevant field changes', () => {
      const inputData = createInitialRunData({
         name: {
            status: 'loaded',
            value: 'John',
            errors: []
         },
         irrelevant: {
            status: 'loaded',
            value: 'initial',
            errors: []
         }
      })
      let latestOutputData: VertexRunData | undefined = undefined
      let outputDataEmissions = 0
      loadFromFields$(['name'], {
         uppercaseName: () => NEVER
      })(
         from([
            inputData,
            {
               ...inputData,
               fields: {
                  ...inputData.fields,
                  irrelevant: {
                     status: 'loaded' as const,
                     value: 'changed',
                     errors: []
                  }
               },
               changedFields: { irrelevant: true as const },
               initialRun: false
            }
         ])
      ).subscribe(outputData => {
         outputDataEmissions++
         latestOutputData = outputData
      })
      expect(outputDataEmissions).to.equal(2)
      expect(latestOutputData!.changedFields).to.deep.equal({
         irrelevant: true
      })
   })
})
