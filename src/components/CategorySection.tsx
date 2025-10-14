import ProductCard from "./ProductCard";

import { Product } from '@/data/products';
import { CartItem } from '@/hooks/useCart';

interface CategorySectionProps {
  title: string;
  products: Product[];
  onAddToCart: (productId: string, quantity: number, productData?: any) => void;
  onPizzaClick?: (pizzaId: string, preSelectedPizza?: string) => void;
  onHalfPizzaClick?: (pizzaId: string) => void; // Nova prop
  cartItems?: CartItem[];
}

const CategorySection = ({ title, products, onAddToCart, onPizzaClick, onHalfPizzaClick, cartItems }: CategorySectionProps) => {
  return (
    <section className="mb-12">
      <h2 className="text-3xl font-bold text-foreground mb-6">
        {title}
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((product) => {
          const cartQty = cartItems?.find(ci => ci.id === product.id)?.quantity || 0;
          return (
            <ProductCard
              key={product.id}
              {...product}
              cartQuantity={cartQty}
              onAddToCart={onAddToCart}
              onPizzaClick={onPizzaClick}
              onHalfPizzaClick={onHalfPizzaClick}
            />
          );
        })}
      </div>
    </section>
  );
};

export default CategorySection;