import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Product } from '@/data/products';
import EditProductModal from '@/pages/admin/components/EditProductModal';
import AddProductModal from '@/pages/admin/components/AddProductModal';

interface ProductListProps {
  products: Product[];
  onUpdateProduct: (productId: string, updates: Partial<Product>) => void;
  onCreateProduct?: (product: Product) => void;
  onDeleteProduct?: (productId: string) => void;
}

const ProductList: React.FC<ProductListProps> = ({ products, onUpdateProduct, onCreateProduct, onDeleteProduct }) => {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const formatPrice = (product: Product) => {
    // Only pizzas use broto/grande sizes. For other categories show a single price.
    const price = product.price;
    if (product.category.startsWith('pizzas-')) {
      return `Broto: R$ ${price.broto.toFixed(2)} | Grande: R$ ${price.grande.toFixed(2)}`;
    }
    // For non-pizza items, show a single price (use 'grande' as canonical)
    return `R$ ${price.grande.toFixed(2)}`;
  };

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Preço</TableHead>
            <TableHead>Disponível</TableHead>
            <TableHead>Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => (
            <TableRow key={product.id}>
              <TableCell>{product.name}</TableCell>
              <TableCell>{formatPrice(product)}</TableCell>
              <TableCell>
                <Switch 
                  checked={product.available === true}
                  onCheckedChange={(checked) => 
                    onUpdateProduct(product.id, { available: checked })
                  }
                />
              </TableCell>
              <TableCell>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedProduct(product);
                    setIsModalOpen(true);
                  }}
                >
                  Editar
                </Button>
                {onDeleteProduct && (
                  <Button className="ml-2" variant="destructive" size="sm" onClick={() => onDeleteProduct(product.id)}>
                    Excluir
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="flex justify-end gap-2 mt-4">
        <Button onClick={() => setIsAddOpen(true)}>Adicionar Produto</Button>
      </div>

      {/* Add product modal */}
      {onCreateProduct && (
        <AddProductModal
          isOpen={isAddOpen}
          onClose={() => setIsAddOpen(false)}
          onCreate={(p) => {
            onCreateProduct(p);
            setIsAddOpen(false);
          }}
          defaultCategory={products[0]?.category}
        />
      )}

      <EditProductModal
        product={selectedProduct}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedProduct(null);
        }}
        onSave={onUpdateProduct}
      />
    </div>
  );
};

export default ProductList;