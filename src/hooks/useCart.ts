import { useState, useCallback, useEffect } from 'react';
import { useProducts } from './useProducts';
import { toast } from '@/components/ui/use-toast';
import pizzaMargherita from "@/assets/pizza-margherita.jpg";
import pizzaPortuguesa from "@/assets/pizza-portuguesa.jpg";
import pizzaPepperoni from "@/assets/pizza-pepperoni.jpg";
import pizzaCalabresa from "@/assets/pizza-calabresa.jpg";
import pizzaQuatroQueijos from "@/assets/pizza-quatro-queijos.jpg";
import pizzaFrangoCatupiry from "@/assets/pizza-frango-catupiry.jpg";
import pizzaVegetariana from "@/assets/pizza-vegetariana.jpg";
import pizzaChocolate from "@/assets/pizza-chocolate.jpg";
import cocaCola from "@/assets/coca-cola.jpg";
import guarana2l from "@/assets/guarana-2l.jpg";
import pudimImage from "@/assets/pudim.jpg";
import brigadeiro from "@/assets/brigadeiro.jpg";
import baconExtra from "@/assets/bacon-extra.jpg";
import queijoExtra from "@/assets/queijo-extra.jpg";
import bordaCatupiry from "@/assets/borda-catupiry.jpg";
import bordaCheddar from "@/assets/borda-cheddar.jpg";
import pizzaMeiaMeia from "@/assets/pizza-meia-meia.jpg";

export interface CartItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  quantity: number;
  image: string;
  isHalfPizza?: boolean;
  customization?: {
    type?: string;
    size?: string;
    sabor1?: string;
    sabor2?: string;
    borda?: string;
    adicionais?: string[];
    observacoes?: string;
    drink?: string;
    pizza1?: string;
    pizza2?: string;
  };
}

const PRODUCT_DETAILS: Record<string, { name: string; description?: string; price: Record<string, number>; image: string }> = {
  // Bebidas
  'coca-cola': {
    name: 'Coca-Cola',
    description: 'Refrigerante Coca-Cola gelado',
    price: { unico: 8.90 },
    image: cocaCola
  },
  'sprite': {
    name: 'Sprite',
    description: 'Refrigerante Sprite gelado',
    price: { unico: 7.90 },
    image: '/placeholder.svg'
  },
  'fanta-laranja': {
    name: 'Fanta Laranja',
    description: 'Refrigerante Fanta Laranja gelado',
    price: { unico: 7.90 },
    image: '/placeholder.svg'
  },
  'fanta-uva': {
    name: 'Fanta Uva',
    description: 'Refrigerante Fanta Uva gelado',
    price: { unico: 7.90 },
    image: '/placeholder.svg'
  },

  // Adicionais
  'alho-gratinado': {
    name: 'Alho Gratinado',
    description: 'Alho gratinado extra',
    price: { unico: 4.90 },
    image: '/placeholder.svg'
  },
  'atum-adicional': {
    name: 'Atum',
    description: 'Atum extra',
    price: { unico: 6.90 },
    image: '/placeholder.svg'
  },
  'bacon-adicional': {
    name: 'Bacon',
    description: 'Bacon extra',
    price: { unico: 5.90 },
    image: baconExtra
  },
  'batata-palha': {
    name: 'Batata Palha',
    description: 'Batata palha extra',
    price: { unico: 3.90 },
    image: '/placeholder.svg'
  },
  'brocolis-adicional': {
    name: 'Brócolis',
    description: 'Brócolis extra',
    price: { unico: 4.90 },
    image: '/placeholder.svg'
  },
  'calabresa-adicional': {
    name: 'Calabresa',
    description: 'Calabresa extra',
    price: { unico: 5.90 },
    image: '/placeholder.svg'
  },
  'catupiry-dallora': {
    name: 'Catupiry Dallora',
    description: 'Catupiry Dallora extra',
    price: { unico: 6.90 },
    image: '/placeholder.svg'
  },
  'catupiry-scala': {
    name: 'Catupiry Scala/Origin',
    description: 'Catupiry Scala ou Origin extra',
    price: { unico: 6.90 },
    image: '/placeholder.svg'
  },
  'cebola-adicional': {
    name: 'Cebola',
    description: 'Cebola extra',
    price: { unico: 3.90 },
    image: '/placeholder.svg'
  },
  'champignon-adicional': {
    name: 'Champignon',
    description: 'Champignon extra',
    price: { unico: 5.90 },
    image: '/placeholder.svg'
  },
  'cheddar-scala': {
    name: 'Cheddar Scala',
    description: 'Cheddar Scala extra',
    price: { unico: 6.90 },
    image: '/placeholder.svg'
  },
  'ervilha-adicional': {
    name: 'Ervilha',
    description: 'Ervilha extra',
    price: { unico: 3.90 },
    image: '/placeholder.svg'
  },
  'frango-adicional': {
    name: 'Frango',
    description: 'Frango extra',
    price: { unico: 5.90 },
    image: '/placeholder.svg'
  },
  'gorgonzola-adicional': {
    name: 'Gorgonzola',
    description: 'Gorgonzola extra',
    price: { unico: 7.90 },
    image: '/placeholder.svg'
  },
  'lombo-adicional': {
    name: 'Lombo',
    description: 'Lombo extra',
    price: { unico: 12.99 },
    image: '/placeholder.svg'
  },
  'milho-adicional': {
    name: 'Milho',
    description: 'Milho extra',
    price: { unico: 3.90 },
    image: '/placeholder.svg'
  },
  'mussarela-adicional': {
    name: 'Mussarela',
    description: 'Mussarela extra',
    price: { unico: 5.90 },
    image: '/placeholder.svg'
  },
  'ovo-adicional': {
    name: 'Ovo',
    description: 'Ovo extra',
    price: { unico: 3.90 },
    image: '/placeholder.svg'
  },
  'palmito-adicional': {
    name: 'Palmito',
    description: 'Palmito extra',
    price: { unico: 6.99 },
    image: '/placeholder.svg'
  },
  'parmesao-adicional': {
    name: 'Parmesão',
    description: 'Parmesão extra',
    price: { unico: 6.99 },
    image: '/placeholder.svg'
  },
  'peperoni-adicional': {
    name: 'Peperoni',
    description: 'Peperoni extra',
    price: { unico: 7.99 },
    image: '/placeholder.svg'
  },
  'pimenta-adicional': {
    name: 'Pimenta',
    description: 'Pimenta extra',
    price: { unico: 2.99 },
    image: '/placeholder.svg'
  },
  'presunto-adicional': {
    name: 'Presunto',
    description: 'Presunto extra',
    price: { unico: 5.99 },
    image: '/placeholder.svg'
  },
  'provolone-adicional': {
    name: 'Provolone',
    description: 'Provolone extra',
    price: { unico: 6.99 },
    image: '/placeholder.svg'
  },

  // Bordas
  'borda-requeijao': {
    name: 'Requeijão',
    description: 'Borda recheada com requeijão',
    price: { unico: 8.90 },
    image: '/placeholder.svg'
  },
  'borda-cheddar-scala': {
    name: 'Cheddar Scala',
    description: 'Borda recheada com cheddar scala',
    price: { unico: 8.90 },
    image: '/placeholder.svg'
  },
  'borda-mussarela': {
    name: 'Mussarela',
    description: 'Borda recheada com mussarela',
    price: { unico: 8.90 },
    image: '/placeholder.svg'
  },
  'borda-catupiry-scala': {
    name: 'Catupiry Scala',
    description: 'Borda recheada com catupiry scala',
    price: { unico: 8.90 },
    image: '/placeholder.svg'
  },
  'borda-cream-cheese': {
    name: 'Cream Cheese',
    description: 'Borda recheada com cream cheese',
    price: { unico: 8.90 },
    image: '/placeholder.svg'
  },
  'borda-chocolate-preto': {
    name: 'Chocolate Preto',
    description: 'Borda recheada com chocolate preto',
    price: { unico: 17.99 },
    image: '/placeholder.svg'
  },
  'borda-chocolate-branco': {
    name: 'Chocolate Branco',
    price: { unico: 17.99 },
    image: '/placeholder.svg'
  },
  'borda-goiabada': {
    name: 'Goiabada',
    price: { unico: 17.99 },
    image: '/placeholder.svg'
  },
  'borda-doce-leite': {
    name: 'Doce de Leite',
    price: { unico: 17.99 },
    image: '/placeholder.svg'
  },
  'borda-catupiry': {
    name: 'Borda Catupiry',
    price: { unico: 6.90 },
    image: bordaCatupiry
  },
  'borda-cheddar': {
    name: 'Borda Cheddar',
    price: { unico: 6.90 },
    image: bordaCheddar
  },
  
  // Pizzas
  'pizza-margherita': { 
    name: 'Margherita', 
    price: { pequena: 32.90, media: 45.90, grande: 58.90, familia: 72.90 }, 
    image: pizzaMargherita 
  },
  'pizza-portuguesa': { 
    name: 'Portuguesa', 
    price: { pequena: 38.90, media: 51.90, grande: 64.90, familia: 78.90 }, 
    image: pizzaPortuguesa 
  },
  'pizza-calabresa': { 
    name: 'Calabresa', 
    price: { pequena: 35.90, media: 48.90, grande: 61.90, familia: 75.90 }, 
    image: pizzaCalabresa 
  },
  'pizza-frango-catupiry': { 
    name: 'Frango c/ Catupiry', 
    price: { pequena: 40.90, media: 53.90, grande: 66.90, familia: 80.90 }, 
    image: pizzaFrangoCatupiry 
  },
  'pizza-quatro-queijos': { 
    name: 'Quatro Queijos', 
    price: { pequena: 42.90, media: 55.90, grande: 68.90, familia: 82.90 }, 
    image: pizzaQuatroQueijos 
  },
  'pizza-pepperoni': { 
    name: 'Pepperoni', 
    price: { pequena: 44.90, media: 57.90, grande: 70.90, familia: 84.90 }, 
    image: pizzaPepperoni 
  },
  'pizza-vegetariana': { 
    name: 'Vegetariana', 
    price: { pequena: 39.90, media: 52.90, grande: 65.90, familia: 79.90 }, 
    image: pizzaVegetariana 
  },
  'pizza-chocolate': { 
    name: 'Chocolate', 
    price: { pequena: 29.90, media: 42.90, grande: 55.90, familia: 68.90 }, 
    image: pizzaChocolate 
  },
  'pudim': { 
    name: 'Pudim de Leite', 
    price: { unico: 12.90 }, 
    image: pudimImage 
  },
  'brigadeiro': { 
    name: 'Brigadeiro Gourmet', 
    price: { unico: 4.50 }, 
    image: brigadeiro 
  }
};

const getProductImage = (productId: string) => {
  return PRODUCT_DETAILS[productId]?.image || '/placeholder.svg';
};

const getProductDetails = (productId: string) => {
  return PRODUCT_DETAILS[productId] || null;
};

export const useCart = () => {
  const [items, setItems] = useState<CartItem[]>(() => {
    const savedItems = localStorage.getItem('cart-items');
    return savedItems ? JSON.parse(savedItems) : [];
  });
  const { products } = useProducts();

  // Persiste o carrinho no localStorage sempre que mudar
  useEffect(() => {
    if (items.length > 0) {
      localStorage.setItem('cart-items', JSON.stringify(items));
    } else {
      localStorage.removeItem('cart-items');
    }
  }, [items]);

  const addToCart = useCallback((productId: string, quantity: number, productData?: any) => {
    console.log('addToCart called:', { productId, quantity, productData });
    
    const product = products.find(p => p.id === productId);

    // Se temos productData (para pizzas customizadas/combos)
    if (productData) {
      setItems(prev => [...prev, {
        id: productId,
        name: productData.name,
        price: productData.price,
        quantity: quantity,
        image: productData.image || '/placeholder.svg',
        customization: productData.customization,
        isHalfPizza: productData.isHalfPizza
      }]);
      return;
    }

    // Para produtos simples (bebidas, adicionais, bordas)
    if (product?.category === 'bebidas' || product?.category === 'adicionais' || product?.category === 'bordas') {
      console.log('Tentando adicionar produto (simple category):', { productId, category: product.category });

      // Primeiro tente os detalhes estáticos (PRODUCT_DETAILS). Se não existir (ex.: produto criado via admin),
      // use os próprios campos do produto vindo da store.
      const productDetails = getProductDetails(productId);
      const resolvedName = productDetails?.name || product?.name || 'Produto';
      const resolvedDescription = productDetails?.description || product?.description || '';
      const resolvedPrice = productDetails ? Object.values(productDetails.price)[0] : (product ? Object.values(product.price)[0] : 0);
      const resolvedImage = productDetails?.image || getProductImage(productId) || '/placeholder.svg';

      setItems(prevItems => {
        const existing = prevItems.find(i => i.id === productId);

        // Se o item já existe no carrinho
        if (existing) {
          const newQuantity = existing.quantity + quantity;

          // Se a nova quantidade é 0 ou menor, remove o item
          if (newQuantity <= 0) {
            return prevItems.filter(i => i.id !== productId);
          }

          // Atualiza a quantidade do item existente
          return prevItems.map(i => 
            i.id === productId ? { ...i, quantity: newQuantity } : i
          );
        }

        // Se é um novo item e a quantidade é positiva
        if (quantity > 0) {
          return [...prevItems, {
            id: productId,
            name: resolvedName,
            description: resolvedDescription,
            price: resolvedPrice,
            quantity: 1,
            image: resolvedImage,
          }];
        }

        return prevItems;
      });

      // Notificação sempre com o nome do produto
      toast({
        title: quantity > 0 ? "Item adicionado" : "Item removido",
        description: quantity > 0 
          ? `${resolvedName} adicionado ao carrinho`
          : `${resolvedName} removido do carrinho`,
        variant: quantity > 0 ? "default" : "destructive",
      });

      return;
    }

    if (!product?.available) {
      toast({
        title: 'Produto indisponível',
        description: 'Este item não está disponível no momento.',
        variant: 'destructive',
      });
      return;
    }

    setItems(prevItems => {
      const existing = prevItems.find(i => i.id === productId);
      const delta = quantity;

      if (existing) {
        const newQty = (existing.quantity || 0) + delta;
        if (newQty <= 0) {
          return prevItems.filter(i => i.id !== productId);
        }
        return prevItems.map(i => i.id === productId ? { ...i, quantity: newQty } : i);
      }

      if (delta > 0) {
        const productDetails = getProductDetails(productId);
        if (productDetails) {
          const price = Object.values(productDetails.price)[0];
          return [...prevItems, {
            id: productId,
            name: productDetails.name,
            price: price,
            quantity: delta,
            image: productDetails.image || '/placeholder.svg'
          }];
        }
      }
      return prevItems;
    });
  }, [products]);

   const updateQuantity = useCallback((itemId: string, quantity: number) => {
     if (quantity <= 0) {
       removeItem(itemId);
     } else {
       setItems(prevItems =>
         prevItems.map(item =>
           item.id === itemId ? { ...item, quantity } : item
         )
       );
     }
   }, []);

   const removeItem = useCallback((itemId: string) => {
     console.log('Removendo item:', itemId);
     setItems(prevItems => {
       const newItems = prevItems.filter(item => item.id !== itemId);
       console.log('Itens após remoção:', newItems);
       return newItems;
     });
   }, []);

   const clearCart = useCallback(() => {
     setItems([]);
   }, []);

   const getTotalItems = useCallback(() => {
     console.log('Calculando total de itens:', items);
     if (!items || items.length === 0) return 0;
     
     const total = items.reduce((acc, item) => {
       const quantity = typeof item.quantity === 'number' ? item.quantity : 0;
       return acc + quantity;
     }, 0);
     
     console.log('Total calculado:', total);
     return total;
   }, [items]);

   const getTotalPrice = useCallback(() => {
     return items.reduce((acc, item) => acc + ((item.price || 0) * (item.quantity || 0)), 0);
   }, [items]);

   return {
     items,
     addToCart,
     updateQuantity,
     removeItem,
     clearCart,
     getTotalItems,
     getTotalPrice
   };
 };