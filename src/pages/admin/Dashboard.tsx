import React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProducts } from '@/hooks/useProducts';
import ProductList from './components/ProductList';
import AddProductModal from './components/AddProductModal';
import EstablishmentSettings from './components/EstablishmentSettings';
import Neighborhoods from './Neighborhoods';

const Dashboard = () => {
  const { products, updateProduct, createProduct, deleteProduct } = useProducts();

  const categorizedProducts = {
    pizzas: products.filter(p => 
      ['pizzas-promocionais', 'pizzas-premium', 'pizzas-tradicionais', 'pizzas-especiais', 'pizzas-doces'].includes(p.category)
    ),
    bebidas: products.filter(p => p.category === 'bebidas'),
    adicionais: products.filter(p => p.category === 'adicionais'),
    bordas: products.filter(p => p.category === 'bordas'),
    combos: products.filter(p => p.category === 'combos'),
  };

  return (
    <div className="container mx-auto p-6">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Configurações do Estabelecimento</CardTitle>
          </CardHeader>
          <CardContent>
            <EstablishmentSettings />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Configurações de Entrega</CardTitle>
          </CardHeader>
          <CardContent>
            <Neighborhoods />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gerenciamento do Cardápio</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="pizzas">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="pizzas">Pizzas</TabsTrigger>
                <TabsTrigger value="bebidas">Bebidas</TabsTrigger>
                <TabsTrigger value="adicionais">Adicionais</TabsTrigger>
                <TabsTrigger value="bordas">Bordas</TabsTrigger>
                <TabsTrigger value="combos">Combos</TabsTrigger>
              </TabsList>
              
              {Object.entries(categorizedProducts).map(([category, items]) => (
                <TabsContent key={category} value={category}>
                  <ProductList 
                    products={items}
                    onUpdateProduct={updateProduct}
                    onCreateProduct={(p) => createProduct(p)}
                    onDeleteProduct={(id) => deleteProduct(id)}
                  />
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>

        {/* Add Product modal root */}
        <AddProductModal isOpen={false} onClose={() => {}} onCreate={(p) => createProduct(p)} />

        <Button 
          onClick={() => {
            const products = categorizedProducts.pizzas.concat(
              categorizedProducts.bebidas,
              categorizedProducts.adicionais,
              categorizedProducts.bordas,
              categorizedProducts.combos
            );
            products.forEach(product => {
              updateProduct(product.id, { available: true });
            });
          }}
          className="w-full"
        >
          Marcar Todos como Disponíveis
        </Button>
      </div>
    </div>
  );
};

export default Dashboard;
