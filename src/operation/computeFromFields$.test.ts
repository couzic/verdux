import { expect } from 'chai'
import { isObservable, map, Observable, of } from 'rxjs'
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
      let outputCount = 0
      let latestOutput: any
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
      })(of(inputData)).subscribe(output => {
         outputCount++
         latestOutput = output
      })
      expect(outputCount).to.equal(2)
      expect(latestOutput.changedFields.uppercaseName).to.be.true
      expect(latestOutput.fields.uppercaseName.value).to.equal('JOHN')
   })

   it('handles loading field', () => {
      let outputCount = 0
      let latestOutput: any
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
      })(of(inputData)).subscribe(output => {
         outputCount++
         latestOutput = output
      })
      expect(outputCount).to.equal(1)
      expect(latestOutput.fields.uppercaseName.status).to.equal('loading')
   })
})
