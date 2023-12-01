import { expect } from 'chai'
import { Subject } from 'rxjs'
import { computeFromFieldsTransformation } from './computeFromFields'

describe(computeFromFieldsTransformation.name + ' unpicked upstream', () => {
   it('keeps in output unpicked redux fields', () => {
      const transformation = computeFromFieldsTransformation(
         ['someLoadableValue'],
         {
            sameLoadableValue: ({ someLoadableValue }) => someLoadableValue
         }
      )
      const internalState$ = new Subject<any>()
      let lastOutput: any
      transformation({})(internalState$).subscribe(
         output => (lastOutput = output)
      )
      internalState$.next({
         versions: {},
         reduxState: {
            vertex: { someValue: 'initial value' }
         },
         readonlyFields: {},
         loadableFields: {
            someLoadableValue: {
               status: 'loaded',
               value: 'Some loadable value'
            }
         }
      })
      internalState$.next({
         versions: {},
         reduxState: {
            vertex: { someValue: 'updated value' }
         },
         readonlyFields: {},
         loadableFields: {
            someLoadableValue: {
               status: 'loaded',
               value: 'Some loadable value'
            }
         }
      })
      expect(lastOutput.reduxState.vertex.someValue).to.equal('updated value')
   })

   it('keeps in output unpicked readonly fields', () => {
      const transformation = computeFromFieldsTransformation(
         ['someLoadableValue'],
         {
            sameLoadableValue: ({ someLoadableValue }) => someLoadableValue
         }
      )
      const internalState$ = new Subject<any>()
      let lastOutput: any
      transformation({})(internalState$).subscribe(
         output => (lastOutput = output)
      )
      internalState$.next({
         versions: {},
         reduxState: {
            vertex: {}
         },
         readonlyFields: { someValue: 'initial value' },
         loadableFields: {
            someLoadableValue: {
               status: 'loaded',
               value: 'Some loadable value'
            }
         }
      })
      internalState$.next({
         versions: {},
         reduxState: {
            vertex: {}
         },
         readonlyFields: { someValue: 'updated value' },
         loadableFields: {
            someLoadableValue: {
               status: 'loaded',
               value: 'Some loadable value'
            }
         }
      })
      expect(lastOutput.readonlyFields.someValue).to.equal('updated value')
   })

   it('keeps in output unpicked readonly fields AND computed fields', () => {
      const transformation = computeFromFieldsTransformation(['someValue'], {
         sameValue: ({ someValue }) => someValue
      })
      const internalState$ = new Subject<any>()
      let lastOutput: any
      transformation({})(internalState$).subscribe(
         output => (lastOutput = output)
      )
      internalState$.next({
         versions: {},
         reduxState: {
            vertex: { someValue: 'Some value' }
         },
         readonlyFields: { unpickedValue: 'Initial unpicked value' },
         loadableFields: {}
      })
      internalState$.next({
         versions: {},
         reduxState: {
            vertex: { someValue: 'Some value' }
         },
         readonlyFields: { unpickedValue: 'Updated unpicked value' },
         loadableFields: {}
      })
      expect(lastOutput.readonlyFields.sameValue).to.equal('Some value')
   })

   it('keeps in output unpicked loadable fields', () => {
      const transformation = computeFromFieldsTransformation(['someValue'], {
         sameValue: ({ someValue }) => someValue
      })
      const internalState$ = new Subject<any>()
      let lastOutput: any
      transformation({})(internalState$).subscribe(
         output => (lastOutput = output)
      )
      internalState$.next({
         versions: {},
         reduxState: {
            vertex: {
               someValue: ''
            }
         },
         readonlyFields: {},
         loadableFields: {
            fromSource: {
               status: 'loading'
            }
         }
      })
      internalState$.next({
         versions: {},
         reduxState: {
            vertex: {
               someValue: ''
            }
         },
         readonlyFields: {},
         loadableFields: {
            fromSource: {
               status: 'loaded',
               value: 'A'
            }
         }
      })
      expect(lastOutput.loadableFields.fromSource).to.deep.equal({
         status: 'loaded',
         value: 'A'
      })
   })

   it('keeps in output unpicked loadable fields AND loadable fields from memory', () => {
      const transformation = computeFromFieldsTransformation(
         ['someLoadableValue'],
         {
            sameLoadableValue: ({ someLoadableValue }) => someLoadableValue
         }
      )
      const internalState$ = new Subject<any>()
      let lastOutput: any
      transformation({})(internalState$).subscribe(
         output => (lastOutput = output)
      )
      internalState$.next({
         versions: {},
         reduxState: {
            vertex: {}
         },
         readonlyFields: {},
         loadableFields: {
            someLoadableValue: {
               status: 'loaded',
               value: 'Some loadable value'
            },
            fromSource: {
               status: 'loading'
            }
         }
      })
      internalState$.next({
         versions: {},
         reduxState: {
            vertex: {
               someValue: ''
            }
         },
         readonlyFields: {},
         loadableFields: {
            someLoadableValue: {
               status: 'loaded',
               value: 'Some loadable value'
            },
            fromSource: {
               status: 'loaded',
               value: 'A'
            }
         }
      })
      expect(lastOutput.loadableFields.sameLoadableValue).to.deep.equal({
         status: 'loaded',
         value: 'Some loadable value',
         error: undefined
      })
   })
})
