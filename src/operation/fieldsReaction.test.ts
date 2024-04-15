import { createAction } from '@reduxjs/toolkit'
import { expect } from 'chai'
import { of } from 'rxjs'
import { VertexRunData } from '../run/RunData'
import { VertexFields } from '../run/VertexFields'
import { VertexStatus } from '../vertex/VertexStatus'
import { fieldsReaction } from './fieldsReaction'

const createRunData = (fieldValues: Record<string, any>): VertexRunData => {
   const fields: VertexFields = {}
   const changedFields: Record<string, true> = {}
   Object.keys(fieldValues).forEach(fieldName => {
      fields[fieldName] = {
         status: 'loaded',
         value: fieldValues[fieldName],
         errors: []
      }
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

describe(fieldsReaction.name, () => {
   it('ignores initial values', () => {
      const input = {
         ...createRunData({ name: 'Bob' }),
         initialRun: true as const
      }
      let callsToMapper = 0
      fieldsReaction(['name'], () => {
         callsToMapper++
         return null
      })({})(of(input)).subscribe()
      expect(callsToMapper).to.equal(0)
   })

   it('reacts to tracked field change', () => {
      const outputAction = createAction<string>('outputAction')
      const input = createRunData({ name: 'Bob' })
      let lastOutput: any = undefined
      fieldsReaction(['name'], ({ name }: any) => outputAction(name))({})(
         of(input)
      ).subscribe(output => (lastOutput = output))
      expect(lastOutput).to.deep.equal({
         ...input,
         fieldsReactions: [outputAction('Bob')]
      })
   })

   it('has access to loadable state', () => {
      const outputAction = createAction<string>('outputAction')
      const input = createRunData({ name: 'Bob' })
      let lastOutput: any = undefined
      let accessedStatus: VertexStatus | undefined = undefined
      fieldsReaction(['name'], ({ name }: any, { status }: any) => {
         accessedStatus = status
         return outputAction(name)
      })({})(of(input)).subscribe(output => (lastOutput = output))
      expect(accessedStatus).to.equal('loaded')
   })

   it('has access to dependencies', () => {
      const outputAction = createAction<string>('outputAction')
      const input = createRunData({ name: 'Bob' })
      let lastOutput: any = undefined
      let accessedDependencies: any
      const dependencies = { someDependency: 'someDependency' }
      fieldsReaction(['name'], ({ name }: any, { dependencies }: any) => {
         accessedDependencies = dependencies
         return outputAction(name)
      })(dependencies)(of(input)).subscribe(output => (lastOutput = output))
      expect(accessedDependencies).to.deep.equal(dependencies)
   })

   it('ignores null mapper outputs', () => {
      const input = createRunData({ name: 'Bob' })
      let lastOutput: any = undefined
      fieldsReaction(['name'], ({ name }: any) => {
         return null
      })({})(of(input)).subscribe(output => (lastOutput = output))
      expect(lastOutput).to.equal(input)
   })
})
