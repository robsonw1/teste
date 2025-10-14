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

interface EditProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onSave: (productId: string, updates: Product) => void;
}

const EditProductModal: React.FC<EditProductModalProps> = ({
  isOpen,
  onClose,
  product,
  onSave,
}) => {
  const [editedProduct, setEditedProduct] = React.useState<Product | null>(null);

  React.useEffect(() => {
    if (product) {
      // Garante que todos os campos necessários estejam inicializados
      const newProduct: Product = {
        ...product,
        price: {
          broto: Number(product.price.broto) || 0,
          grande: Number(product.price.grande) || 0
        },
        ingredients: product.ingredients || [],
        drinkOptions: product.drinkOptions || [],
        available: product.available || false,
        pizzaCount: product.pizzaCount || 1
      };
      setEditedProduct(newProduct);
    }
  }, [product]);

  const handleSave = () => {
    if (!editedProduct) return;

    // Validação básica
    if (!editedProduct.name?.trim()) {
      toast({
        title: "Erro ao salvar",
        description: "O nome do produto é obrigatório",
        variant: "destructive",
      });
      return;
    }

    if (!editedProduct.description?.trim()) {
      toast({
        title: "Erro ao salvar",
        description: "A descrição do produto é obrigatória",
        variant: "destructive",
      });
      return;
    }

    if (editedProduct.price.broto <= 0 || editedProduct.price.grande <= 0) {
      toast({
        title: "Erro ao salvar",
        description: "Os preços devem ser maiores que zero",
        variant: "destructive",
      });
      return;
    }

    onSave(editedProduct.id, editedProduct);
    toast({
      title: "Sucesso",
      description: "Produto atualizado com sucesso",
    });
    onClose();
  };

  if (!product || !editedProduct) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Editar Produto: {product?.name || ''}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Nome
            </Label>
            <Input
              id="name"
              value={editedProduct.name}
              className="col-span-3"
              onChange={(e) => setEditedProduct(prev => prev ? ({ ...prev, name: e.target.value }) : null)}
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="description" className="text-right">
              Descrição
            </Label>
            <Textarea
              id="description"
              value={editedProduct.description}
              className="col-span-3"
              onChange={(e) => setEditedProduct(prev => prev ? ({ ...prev, description: e.target.value }) : null)}
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Preços</Label>
            <div className="col-span-3 grid grid-cols-2 gap-4">
              {product.category.startsWith('pizzas-') ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="price-broto">Broto</Label>
                    <Input
                      id="price-broto"
                      type="number"
                      step="0.01"
                      value={editedProduct.price.broto}
                      onChange={(e) => {
                        if (!editedProduct) return;
                        const newProduct: Product = {
                          ...editedProduct,
                          price: {
                            ...editedProduct.price,
                            broto: parseFloat(e.target.value) || 0
                          }
                        };
                        setEditedProduct(newProduct);
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price-grande">Grande</Label>
                    <Input
                      id="price-grande"
                      type="number"
                      step="0.01"
                      value={editedProduct.price.grande}
                      onChange={(e) => {
                        if (!editedProduct) return;
                        const newProduct: Product = {
                          ...editedProduct,
                          price: {
                            ...editedProduct.price,
                            grande: parseFloat(e.target.value) || 0
                          }
                        };
                        setEditedProduct(newProduct);
                      }}
                    />
                  </div>
                </>
              ) : (
                <div className="col-span-2">
                  <Label htmlFor="price-unico">Preço</Label>
                  <Input
                    id="price-unico"
                    type="number"
                    step="0.01"
                    value={editedProduct.price.grande}
                    onChange={(e) => {
                      if (!editedProduct) return;
                      const value = parseFloat(e.target.value) || 0;
                      setEditedProduct(prev => ({
                        ...prev,
                        price: { broto: value, grande: value }
                      } as Product));
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {product.category.startsWith('pizzas-') && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="ingredients" className="text-right">
                Ingredientes
              </Label>
              <Textarea
                id="ingredients"
                value={editedProduct.ingredients.join(', ')}
                className="col-span-3"
                placeholder="Ingrediente 1, Ingrediente 2, ..."
                onChange={(e) => setEditedProduct(prev => ({
                  ...prev,
                  ingredients: e.target.value.split(',').map(i => i.trim()).filter(Boolean)
                }))}
              />
            </div>
          )}

          {(product.category === 'combos' || product.category.startsWith('pizzas-')) && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="drinkOptions" className="text-right">
                Opções de Bebida
              </Label>
              <Textarea
                id="drinkOptions"
                value={editedProduct.drinkOptions.join(', ')}
                className="col-span-3"
                placeholder="Bebida 1, Bebida 2, ..."
                onChange={(e) => setEditedProduct(prev => ({
                  ...prev,
                  drinkOptions: e.target.value.split(',').map(i => i.trim()).filter(Boolean)
                }))}
              />
            </div>
          )}

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="available" className="text-right">
              Disponível
            </Label>
            <div className="col-span-3">
              <Switch
                id="available"
                checked={editedProduct.available}
                onCheckedChange={(checked) => setEditedProduct(prev => ({ ...prev, available: checked }))}
              />
            </div>
          </div>

          {product.category === 'combos' && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="pizzaCount" className="text-right">
                Quantidade de Pizzas
              </Label>
              <Input
                id="pizzaCount"
                type="number"
                value={editedProduct.pizzaCount || 1}
                className="col-span-3"
                onChange={(e) => setEditedProduct(prev => ({
                  ...prev,
                  pizzaCount: parseInt(e.target.value)
                }))}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="mr-2">
            Cancelar
          </Button>
          <Button type="submit" onClick={handleSave}>
            Salvar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditProductModal;