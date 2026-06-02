import { Suspense } from 'react'
import { productPageVertexConfig, productPageActions } from './productPageVertexConfig'
import { GraphContext } from './GraphContext'
import { graph } from './graph'
import { useVertexState } from './useVertexState'

// A page with three independently-suspending leaves. Each leaf calls
// useVertexState with the exact fields it needs; each is wrapped in its
// own <Suspense>. The page skeleton renders instantly.

export const App = () => (
   <GraphContext.Provider value={graph}>
      <ProductPage />
   </GraphContext.Provider>
)

export const ProductPage = () => (
   <main>
      <Header />
      <Suspense fallback={<Spinner />}>
         <ProductDisplay />
      </Suspense>
      <Suspense fallback={<Spinner />}>
         <RelatedProducts />
      </Suspense>
   </main>
)

// Header does not read vertex state at all — renders instantly.
const Header = () => <h1>Product</h1>

// Reads only `product`. Does not rerender when relatedProducts changes.
const ProductDisplay = () => {
   const { product } = useVertexState({
      vertex: productPageVertexConfig,
      fields: ['product']
   })
   if (product === null) return <NotFound />
   return <article>{product.name}</article>
}

// Reads only `relatedProducts`. Suspends independently of ProductDisplay.
const RelatedProducts = () => {
   const { relatedProducts } = useVertexState({
      vertex: productPageVertexConfig,
      fields: ['relatedProducts']
   })
   return (
      <ul>
         {relatedProducts.map(p => (
            <li key={p.id}>{p.name}</li>
         ))}
      </ul>
   )
}

// Dispatch from anywhere in the tree — inline on the module-singleton graph,
// no hook.
export const AddToCartButton = ({ productId }: { productId: string }) => (
   <button onClick={() => graph.dispatch(productPageActions.addToCart(productId))}>
      Add to cart
   </button>
)

const Spinner = () => <div>Loading…</div>
const NotFound = () => <div>Not found</div>
