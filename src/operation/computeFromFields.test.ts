import { expect } from 'chai'
import { Subject, of } from 'rxjs'
import { VertexRunData } from '../run/RunData'
import { computeFromFields } from './computeFromFields'

const sut = computeFromFields

describe(sut.name, () => {
   it('catches error thrown by computer', () => {
      const run = computeFromFields(['name'], {
         uppercaseName: (_: any) => (undefined as any).toUpperCase()
      })
      const input: VertexRunData = {
         action: undefined,
         fields: {
            name: { status: 'loaded', value: 'Bob', errors: [] }
         },
         changedFields: {
            name: true
         },
         fieldsReactions: [],
         reactions: []
      }
      let lastOutput: VertexRunData | undefined = undefined
      run(of(input)).subscribe(output => {
         lastOutput = output
      })
      expect(lastOutput!.fields.uppercaseName.status).to.equal('error')
   })

   it('computes from changed loaded field', () => {
      const run = computeFromFields(['name'], {
         uppercaseName: (_: any) => _.name.toUpperCase()
      })
      const input: VertexRunData = {
         action: undefined,
         fields: {
            name: { status: 'loaded', value: 'Bob', errors: [] }
         },
         changedFields: {
            name: true
         },
         fieldsReactions: [],
         reactions: []
      }
      let lastOutput: VertexRunData | undefined = undefined
      run(of(input)).subscribe(output => {
         lastOutput = output
      })
      expect(lastOutput).to.deep.equal({
         ...input,
         fields: {
            ...input.fields,
            uppercaseName: { status: 'loaded', value: 'BOB', errors: [] }
         },
         changedFields: {
            ...input.changedFields,
            uppercaseName: true
         }
      })
   })

   it('computes from UNchanged loaded field', () => {
      const run = computeFromFields(['name'], {
         uppercaseName: (_: any) => _.name.toUpperCase()
      })
      const input: VertexRunData = {
         action: undefined,
         fields: {
            name: { status: 'loaded', value: 'Bob', errors: [] }
         },
         changedFields: {
            name: true
         },
         fieldsReactions: [],
         reactions: []
      }
      let lastOutput: VertexRunData | undefined = undefined
      run(of(input, { ...input, changedFields: {} })).subscribe(output => {
         lastOutput = output
      })
      expect(lastOutput).to.deep.equal({
         ...input,
         fields: {
            ...input.fields,
            uppercaseName: { status: 'loaded', value: 'BOB', errors: [] }
         },
         changedFields: {}
      })
   })

   it('computes from changed LOADABLE field', () => {
      const run = computeFromFields(['name'], {
         uppercaseName: (_: any) => _.name.toUpperCase()
      })
      const input$ = new Subject<VertexRunData>()
      let lastOutput: VertexRunData | undefined = undefined
      run(input$).subscribe(output => {
         lastOutput = output
      })
      input$.next({
         action: undefined,
         fields: {
            name: { status: 'loading', value: undefined, errors: [] }
         },
         changedFields: {
            name: true
         },
         fieldsReactions: [],
         reactions: []
      })
      expect(lastOutput!.fields.uppercaseName.status).to.equal('loading')

      input$.next({
         action: undefined,
         fields: {
            name: { status: 'loaded', value: 'Bob', errors: [] }
         },
         changedFields: {
            name: true
         },
         fieldsReactions: [],
         reactions: []
      })
      expect(lastOutput!.fields.uppercaseName).to.deep.equal({
         status: 'loaded',
         value: 'BOB',
         errors: []
      })
      expect(lastOutput!.changedFields.uppercaseName).to.be.true
   })

   it('computes from field IN ERROR', () => {
      const run = computeFromFields(['name'], {
         uppercaseName: (_: any) => _.name.toUpperCase()
      })
      const error = new Error()
      const input: VertexRunData = {
         action: undefined,
         fields: {
            name: { status: 'error', value: undefined, errors: [error] }
         },
         changedFields: {
            name: true
         },
         fieldsReactions: [],
         reactions: []
      }
      let lastOutput: VertexRunData | undefined = undefined
      run(of(input)).subscribe(output => {
         lastOutput = output
      })
      expect(lastOutput).to.deep.equal({
         ...input,
         fields: {
            ...input.fields,
            uppercaseName: {
               status: 'error',
               value: undefined,
               errors: [error]
            }
         },
         changedFields: {
            ...input.changedFields,
            uppercaseName: true
         }
      })
   })
})
