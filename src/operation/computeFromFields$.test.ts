import { expect } from 'chai'
import { isObservable, map, Observable, of, Subject } from 'rxjs'
import { VertexRunData } from '../run/RunData'
import { computeFromFields$ } from './computeFromFields$'

const sut = computeFromFields$

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

describe(sut.name, () => {
   it('computes from picked loaded field', () => {
      const outputs: any[] = []
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
      sut(['name'], {
         uppercaseName: (fields$: Observable<{ name: string }>) => {
            expect(isObservable(fields$)).to.be.true
            fields$.subscribe(fields => {
               expect(fields).to.deep.equal({ name: 'John' })
            })
            return fields$.pipe(map(fields => fields.name.toUpperCase()))
         }
      })(of(inputData)).subscribe(output => outputs.push(output))
      expect(
         outputs.map(output => output.fields.uppercaseName)
      ).to.deep.equal([
         { status: 'loading', value: undefined, errors: [] },
         { status: 'loaded', value: 'JOHN', errors: [] }
      ])
   })

   it('handles loading field', () => {
      const outputs: any[] = []
      const inputData = createInitialRunData({
         name: {
            status: 'loading',
            value: undefined,
            errors: []
         }
      })
      sut(['name'], {
         uppercaseName: (fields$: Observable<{ name: string }>) =>
            fields$.pipe(map(fields => fields.name.toUpperCase()))
      })(of(inputData)).subscribe(output => outputs.push(output))
      expect(
         outputs.map(output => output.fields.uppercaseName.status)
      ).to.deep.equal(['loading'])
   })

   it('handles immediately emitting computer', () => {
      const outputs: any[] = []
      const inputData = createInitialRunData({
         name: {
            status: 'loading',
            value: undefined,
            errors: []
         }
      })
      sut(['name'], {
         uppercaseName: () => of('DEFAULT')
      })(of(inputData)).subscribe(output => outputs.push(output))
      expect(
         outputs.map(output => output.fields.uppercaseName)
      ).to.deep.equal([
         { status: 'loading', value: undefined, errors: [] },
         { status: 'loaded', value: 'DEFAULT', errors: [] }
      ])
   })

   it('resets the computed field to loading on every input change, before the recomputed value', () => {
      const input$ = new Subject<VertexRunData>()
      const outputs: any[] = []
      sut(['x'], {
         doubled: (fields$: Observable<{ x: number }>) =>
            fields$.pipe(map(({ x }) => x * 2))
      })(input$).subscribe(output => outputs.push(output))

      input$.next(
         createInitialRunData({ x: { status: 'loaded', value: 1, errors: [] } })
      )
      input$.next({
         action: undefined,
         fields: { x: { status: 'loaded', value: 5, errors: [] } },
         changedFields: { x: true },
         fieldsReactions: [],
         reactions: [],
         sideEffects: [],
         initialRun: false
      })

      const loading = { status: 'loading', value: undefined }
      const loaded = (value: number) => ({ status: 'loaded', value })
      const statusAndValue = (field: any) => ({
         status: field.status,
         value: field.value
      })
      expect(
         outputs.map(output => ({
            x: statusAndValue(output.fields.x),
            doubled: statusAndValue(output.fields.doubled)
         }))
      ).to.deep.equal([
         { x: loaded(1), doubled: loading },
         { x: loaded(1), doubled: loaded(2) },
         { x: loaded(5), doubled: loading },
         { x: loaded(5), doubled: loaded(10) }
      ])
   })
})
