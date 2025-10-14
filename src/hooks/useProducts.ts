import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Product, products as initialProducts } from '@/data/products';

interface ProductsStore {
  products: Product[];
  updateProduct: (productId: string, updates: Partial<Product>) => void;
  createProduct: (newProduct: Product) => void;
  deleteProduct: (productId: string) => void;
  getProductsByCategory: (category: string) => Product[];
}

export const useProducts = create<ProductsStore>()(
  persist(
    (set, get) => ({
      products: initialProducts.map(product => ({ ...product, available: true })),
          updateProduct: (productId, updates) =>
            set((state) => ({
              products: state.products.map((product) =>
                product.id === productId
                  ? { ...product, ...updates }
                  : product
              ),
            })),
          createProduct: (newProduct: Product) =>
            set((state) => ({ products: [newProduct, ...state.products] })),
          deleteProduct: (productId: string) =>
            set((state) => ({ products: state.products.filter(p => p.id !== productId) })),
      getProductsByCategory: (category: string) => {
        return get().products.filter(product => product.category === category);
      },
    }),
    {
      name: 'products-storage',
    }
  )
);