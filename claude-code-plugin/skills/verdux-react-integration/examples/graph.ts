import { createGraph } from 'verdux'
import { productPageVertexConfig } from './productPageVertexConfig'

// Module-singleton graph. Created once as a side effect of the first import
// and kept for the life of the page. See the SKILL body.
export const graph = createGraph({
   vertices: [productPageVertexConfig]
})
