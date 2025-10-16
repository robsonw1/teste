import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import ProductCard from "./ProductCard";
import { CartItem } from '@/hooks/useCart';
import { categories } from "@/data/products";
import { useProducts } from "@/hooks/useProducts";

interface Product {
  id: string;
  name: string;
  description: string;
  price: { broto: number; grande: number };
  category: 'combos' | 'pizzas-promocionais' | 'pizzas-premium' | 'pizzas-tradicionais' | 'pizzas-especiais' | 'pizzas-doces' | 'bebidas' | 'adicionais' | 'bordas';
  isPopular?: boolean;
  ingredients?: string[];
  portions?: string;
  drinkOptions?: string[];
  pizzaCount?: number;
}

interface MobileMenuAccordionProps {
  onAddToCart: (productId: string, quantity: number, productData?: any) => void;
  onPizzaClick?: (pizzaId: string) => void;
  onHalfPizzaClick?: (pizzaId: string) => void;
  updateProductImages: (products: Product[]) => Product[];
  cartItems?: CartItem[];
  openCategories: string[];
  setOpenCategories: (categories: string[]) => void;
}

const MobileMenuAccordion = ({ 
  onAddToCart, 
  onPizzaClick, 
  onHalfPizzaClick, 
  updateProductImages,
  cartItems,
  openCategories,
  setOpenCategories
}: MobileMenuAccordionProps) => {
  const { products } = useProducts();

  return (
    <div className="md:hidden">
      <Accordion type="multiple" value={openCategories} onValueChange={setOpenCategories}>
        {categories.map((category) => {
          const categoryProducts = updateProductImages(products.filter(product => product.category === category.id));
          if (categoryProducts.length === 0) return null;
          
          return (
            <AccordionItem key={category.id} value={category.id} className="border-none" id={category.id}>
              <AccordionTrigger className="bg-white/50 backdrop-blur-sm rounded-lg px-4 py-3 mb-2 hover:bg-white/70 transition-all">
                <div className="flex items-center gap-3 text-left">
                  <span className="text-2xl">{category.icon}</span>
                  <div>
                    <h3 className="font-semibold text-foreground">{category.name}</h3>
                    <p className="text-sm text-muted-foreground">{categoryProducts.length} itens</p>
                  </div>
                </div>
              </AccordionTrigger>
              
              <AccordionContent className="pb-6">
                <div className="grid grid-cols-1 gap-4 px-2">
                  {categoryProducts.map((product) => {
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
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
};

export default MobileMenuAccordion;
