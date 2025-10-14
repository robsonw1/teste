import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Product } from '@/data/products';
import { toast } from '@/components/ui/use-toast';

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (product: Product) => void;
  defaultCategory?: string;
}

const slugify = (text: string) =>
  text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

type ProductForm = Partial<Product> & { price?: Partial<Product['price']>, category?: Product['category'] };

const AddProductModal: React.FC<AddProductModalProps> = ({ isOpen, onClose, onCreate, defaultCategory }) => {
  const [product, setProduct] = React.useState<ProductForm>({
    id: '',
    name: '',
    description: '',
    price: { broto: 0, grande: 0 },
    category: (defaultCategory as Product['category']) || 'pizzas-promocionais',
    ingredients: [],
    drinkOptions: [],
    available: true,
    pizzaCount: 1,
  });

  React.useEffect(() => {
    setProduct((prev) => ({ ...(prev || {}), category: (defaultCategory as Product['category']) || prev?.category } as ProductForm));
  }, [defaultCategory]);

  const handleSave = () => {
    if (!product.name || !product.description) {
      toast({ title: 'Erro', description: 'Nome e descrição são obrigatórios', variant: 'destructive' });
      return;
    }
    const id = product.id && product.id.trim() ? slugify(product.id) : slugify(product.name || Date.now().toString());
    const newProduct: Product = {
      id,
      name: product.name || '',
      description: product.description || '',
      price: {
        broto: Number(product.price?.broto) || 0,
        grande: Number(product.price?.grande) || 0,
      },
      category: product.category as any,
      isPopular: product.isPopular || false,
      ingredients: product.ingredients || [],
      drinkOptions: product.drinkOptions || [],
      pizzaCount: product.pizzaCount || 1,
      available: product.available ?? true,
    };

    onCreate(newProduct);
    toast({ title: 'Sucesso', description: 'Produto criado' });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Adicionar Produto</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">Nome</Label>
            <Input id="name" value={product.name || ''} className="col-span-3" onChange={(e) => setProduct(p => ({ ...(p||{}), name: e.target.value }))} />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="category" className="text-right">Categoria</Label>
            <select id="category" value={product.category || ''} className="col-span-3 rounded-md bg-surface p-2" onChange={(e) => setProduct(p => ({ ...(p||{}), category: e.target.value as Product['category'] }))}>
              <option value="pizzas-promocionais">Pizzas - Promocionais</option>
              <option value="pizzas-premium">Pizzas - Premium</option>
              <option value="pizzas-tradicionais">Pizzas - Tradicionais</option>
              <option value="pizzas-especiais">Pizzas - Especiais</option>
              <option value="pizzas-doces">Pizzas - Doces</option>
              <option value="bebidas">Bebidas</option>
              <option value="adicionais">Adicionais</option>
              <option value="bordas">Bordas</option>
              <option value="combos">Combos</option>
            </select>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="description" className="text-right">Descrição</Label>
            <Textarea id="description" value={product.description || ''} className="col-span-3" onChange={(e) => setProduct(p => ({ ...(p||{}), description: e.target.value }))} />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Preços</Label>
            <div className="col-span-3 grid grid-cols-2 gap-4">
              {product.category?.startsWith('pizzas-') ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="price-broto">Broto</Label>
                    <Input id="price-broto" type="number" step="0.01" value={product.price?.broto || 0} onChange={(e) => setProduct(p => ({ ...(p||{}), price: { broto: parseFloat(e.target.value) || 0, grande: p?.price?.grande ?? 0 } }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price-grande">Grande</Label>
                    <Input id="price-grande" type="number" step="0.01" value={product.price?.grande || 0} onChange={(e) => setProduct(p => ({ ...(p||{}), price: { broto: p?.price?.broto ?? 0, grande: parseFloat(e.target.value) || 0 } }))} />
                  </div>
                </>
              ) : (
                <div className="col-span-2">
                  <Label htmlFor="price-unico">Preço</Label>
                  <Input id="price-unico" type="number" step="0.01" value={product.price?.grande || 0} onChange={(e) => {
                    const value = parseFloat(e.target.value) || 0;
                    setProduct(p => ({ ...(p||{}), price: { broto: value, grande: value } } as ProductForm));
                  }} />
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="available" className="text-right">Disponível</Label>
            <div className="col-span-3"><Switch id="available" checked={product.available ?? true} onCheckedChange={(checked) => setProduct(p => ({ ...(p||{}), available: checked }))} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="mr-2">Cancelar</Button>
          <Button onClick={handleSave}>Criar Produto</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddProductModal;
