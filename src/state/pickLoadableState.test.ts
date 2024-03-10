import { expect } from 'chai'
import { pickLoadableState } from './pickLoadableState'
import { VertexLoadableState } from '../old/state/VertexLoadableState'

describe(pickLoadableState.name, () => {
   it('picks fields', () => {
      const loadableState: VertexLoadableState<{
         fields: { name: string; age: number }
         loadableFields: {}
         dependencies: {}
      }> = {
         status: 'loaded',
         errors: [],
         state: { name: '', age: 0 },
         fields: {
            name: {
               status: 'loaded',
               value: '',
               errors: []
            }
         }
      }
      expect(pickLoadableState(loadableState, ['name'])).to.deep.equal({
         status: 'loaded',
         errors: [],
         state: { name: '' },
         fields: {
            name: {
               status: 'loaded',
               value: '',
               errors: []
            }
         }
      })
   })
})
