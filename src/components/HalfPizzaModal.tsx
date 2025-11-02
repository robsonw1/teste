import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import DevelopedBy from "@/components/DevelopedBy";
import ScrollHint from "@/components/ui/ScrollHint";
import { Product } from "@/data/products";
import { useProducts } from "@/hooks/useProducts";

interface PizzaFlavor {
  id: string;
  name: string;
  price: { broto: number; grande: number };
  ingredients?: string[];
}

interface HalfPizzaModalProps {
  isOpen: boolean;
  onClose: () => void;
  pizzas: PizzaFlavor[];
  onAddToCart: (productId: string, quantity: number, productData: any) => void;
  preSelectedFlavor?: PizzaFlavor; // Sabor pré-selecionado
  allowedPizzaCategories?: string[]; // Categorias permitidas (opcional)
  isComboContext?: boolean; // Se está no contexto de combo
  combo?: Product | null; // Dados do combo se aplicável
  // When set, the modal will not call onAddToCart. Instead it will return the
  // selected half flavors through this callback and close. Useful when used
  // as a sub-selector inside combo customization.
  returnSelectionOnly?: boolean;
  onConfirmSelection?: (selection: { half1Id: string; half2Id: string; half1Name: string; half2Name: string }) => void;
}

const HalfPizzaModal = ({ isOpen, onClose, pizzas, onAddToCart, preSelectedFlavor, allowedPizzaCategories, isComboContext = false, combo = null, returnSelectionOnly = false, onConfirmSelection }: HalfPizzaModalProps) => {
  const [selectedFlavor1, setSelectedFlavor1] = useState<PizzaFlavor | null>(preSelectedFlavor || null);
  const [selectedFlavor2, setSelectedFlavor2] = useState<PizzaFlavor | null>(null);
  const [selectedDrink, setSelectedDrink] = useState<string>('sem-bebida');
  // refs and hint
  const sabor2Ref = useRef<HTMLDivElement | null>(null);
  const resumoRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const highlightRef = useRef<any>(null);
  const [showScrollHint, setShowScrollHint] = useState<boolean>(true);

  const scrollToSection = (el: HTMLElement | null) => {
    // Auto-scroll/highlight removed for stability on fragile WebViews. Keep hint only.
    return;
  };

  useEffect(() => {
    if (!contentRef.current) return;
    const el = contentRef.current;
    let hideTimeout: any = null;
    const onScroll = () => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 160) setShowScrollHint(false);
      else setShowScrollHint(true);
      clearTimeout(hideTimeout);
      hideTimeout = setTimeout(() => setShowScrollHint(false), 4000);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    const autoHide = setTimeout(() => setShowScrollHint(false), 7000);
    return () => { el.removeEventListener('scroll', onScroll); clearTimeout(autoHide); clearTimeout(hideTimeout);} ;
  }, [isOpen]);

  // Atualiza sabor 1 quando houver pré-seleção
  useEffect(() => {
    if (preSelectedFlavor) {
      setSelectedFlavor1(preSelectedFlavor);
    }
  }, [preSelectedFlavor]);

  // Define bebida padrão para combos
  useEffect(() => {
    if (isOpen) {
      if (isComboContext && combo?.drinkOptions && combo.drinkOptions.length > 0) {
        setSelectedDrink(combo.drinkOptions[0]);
      } else {
        // Default to 'Sem Bebida' for normal pizzas
        setSelectedDrink('sem-bebida');
      }
    }
  }, [isOpen, combo]);

  // Reset/cleanup when modal closes or unmounts
  useEffect(() => {
    if (!isOpen) {
      setSelectedFlavor1(preSelectedFlavor || null);
      setSelectedFlavor2(null);
      setSelectedDrink(combo?.drinkOptions?.[0] || 'sem-bebida');
    }
  }, [isOpen]);

  const isComboFamilia = combo?.pizzaCount === 2;
  
  // Opções de bebida para combos
  const { products } = useProducts();
  // Opções de bebida para combos
  const drinkOptions = combo?.drinkOptions?.map(drinkId => {
    const drink = products.find(p => p.id === drinkId);
    return drink ? { id: drink.id, name: drink.name } : null;
  }).filter(Boolean) || [];

  // Todas as bebidas (para seleção opcional em pizzas não-combo)
  const allBebidas = products.filter(p => p.category === 'bebidas');
  const bebidasOptions = [
    { id: 'sem-bebida', name: 'Sem Bebida', price: 0 },
    ...allBebidas.map(b => ({ id: b.id, name: b.name, price: (b.price && (b.price.grande ?? Object.values(b.price)[0])) || 0 }))
  ];

  // Calcula o preço baseado no sabor mais caro (usando preço grande como referência)
  const calculatePrice = () => {
    if (!selectedFlavor1 || !selectedFlavor2) return 0;
    // Para combos, não calcula preço aqui, apenas mostra que é grátis
    if (isComboContext) return 0;
    let price = Math.max(selectedFlavor1.price.grande, selectedFlavor2.price.grande);
    // adicionar preço da bebida se selecionada (não 'sem-bebida')
    if (selectedDrink && selectedDrink !== 'sem-bebida') {
      const drink = bebidasOptions.find(d => d.id === selectedDrink);
      if (drink) price += drink.price;
    }
    return price;
  };

  const handleAddToCart = () => {
    if (!selectedFlavor1 || !selectedFlavor2) {
      toast({
        title: "Selecione os sabores",
        description: isComboFamilia ? "Por favor, escolha os sabores das duas pizzas." : "Por favor, escolha 2 sabores para sua pizza meio a meio.",
        variant: "destructive",
      });
      return;
    }

    // Para combos, validar se bebida foi selecionada
    if (isComboContext && !selectedDrink) {
      toast({
        title: "Selecione a bebida",
        description: "Por favor, escolha a bebida do combo.",
        variant: "destructive",
      });
      return;
    }

  const price = calculatePrice();
    let productName = "";
    let productId = "";

    if (isComboContext && combo) {
      // Para combos
      const selectedDrinkData = products.find(p => p.id === selectedDrink);
      if (isComboFamilia) {
        productName = `${combo.name} - ${selectedFlavor1.name} + ${selectedFlavor2.name} + ${selectedDrinkData?.name}`;
        productId = `${combo.id}-familia-${Date.now()}`;
      } else {
        productName = `${combo.name} - Pizza Meio a Meio: ${selectedFlavor1.name} + ${selectedFlavor2.name} + ${selectedDrinkData?.name}`;
        productId = `${combo.id}-meia-${Date.now()}`;
      }
    } else {
      // Para pizza meio a meio normal
      const drinkName = selectedDrink === 'sem-bebida' ? 'Sem Bebida' : (bebidasOptions.find(d => d.id === selectedDrink)?.name || '');
      productName = `Pizza Meio a Meio: ${selectedFlavor1.name} + ${selectedFlavor2.name}${drinkName ? ` + ${drinkName}` : ''}`;
      productId = `half-pizza-${selectedFlavor1.id}-${selectedFlavor2.id}-${selectedDrink}`;
    }

    const productData = {
      name: productName,
      price: isComboContext ? combo?.price.grande : price,
      image: '/placeholder.svg',
      isHalfPizza: true,
      halfFlavor1: selectedFlavor1.name,
      halfFlavor2: selectedFlavor2.name,
      customization: isComboContext ? {
        drink: products.find(p => p.id === selectedDrink)?.name,
        pizza1: selectedFlavor1.name,
        pizza2: selectedFlavor2.name
      } : {
        drink: selectedDrink === 'sem-bebida' ? 'Sem Bebida' : (bebidasOptions.find(d => d.id === selectedDrink)?.name || undefined),
        pizza1: selectedFlavor1.name,
        pizza2: selectedFlavor2.name
      }
    };
    // If the caller only wants the selection (e.g. combo modal), return it
    // through the callback instead of adding to cart directly.
    if (returnSelectionOnly && onConfirmSelection) {
      onConfirmSelection({
        half1Id: selectedFlavor1.id,
        half2Id: selectedFlavor2.id,
        half1Name: selectedFlavor1.name,
        half2Name: selectedFlavor2.name,
      });
      // Reset selections
      setSelectedFlavor1(preSelectedFlavor || null);
      setSelectedFlavor2(null);
      setSelectedDrink(combo?.drinkOptions?.[0] || '');
      onClose();
      return;
    }

    // perform add to cart but do not close here; closing handled by handleConfirm
    try {
      onAddToCart(productId, 1, productData);
      toast({
        title: isComboContext ? "Combo adicionado!" : "Pizza adicionada!",
        description: `${productName} foi adicionado ao carrinho.`,
      });
      // Reset selections
      setSelectedFlavor1(preSelectedFlavor || null);
      setSelectedFlavor2(null);
      setSelectedDrink(combo?.drinkOptions?.[0] || 'sem-bebida');
      return true;
    } catch (err) {
      console.error('add to cart failed', err);
      toast({ title: 'Erro', description: 'Não foi possível adicionar ao carrinho.', variant: 'destructive' });
      return false;
    }
  };

  const handleClose = () => {
    try { onClose(); } catch (e) {}
  };

  const handleConfirm = async () => {
    const ok = await Promise.resolve(handleAddToCart());
    if (ok) setTimeout(() => { try { onClose(); } catch(e) {} }, 0);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <div ref={contentRef} className="max-h-[90vh] overflow-y-auto p-4 relative">
          <ScrollHint show={showScrollHint} />
          <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center">
            🍕 {isComboContext ? `Personalizar ${combo?.name}` : 'Pizza Meio a Meio'}
          </DialogTitle>
          <p className="text-muted-foreground">
            {isComboContext 
              ? (isComboFamilia ? "Escolha os sabores das duas pizzas e a bebida do combo." : "Escolha 2 sabores diferentes e a bebida do combo.")
              : "Escolha 2 sabores diferentes. O preço será calculado pelo sabor mais caro."
            }
          </p>
        </DialogHeader>

        {/* Bebidas (Opcional) para pizzas normais */}
        {!isComboContext && bebidasOptions.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Bebidas (Opcional)</h3>
            <RadioGroup value={selectedDrink} onValueChange={setSelectedDrink}>
              {bebidasOptions.map((drink) => (
                <div key={drink.id} className="flex items-center space-x-2 p-3 border rounded-lg">
                  <RadioGroupItem value={drink.id} id={`drink-${drink.id}`} />
                  <Label htmlFor={`drink-${drink.id}`} className="flex-1 cursor-pointer">
                    <div className="flex justify-between items-center">
                      <div className="font-medium text-sm">{drink.name}</div>
                      <div className="font-bold text-brand-red text-sm">
                        {drink.price === 0 ? (drink.id === 'sem-bebida' ? 'Grátis' : 'R$ 0,00') : `+ R$ ${drink.price.toFixed(2).replace('.', ',')}`}
                      </div>
                    </div>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        )}

        {/* Seleção de Bebida para Combos */}
        {isComboContext && drinkOptions.length > 0 && (
          <>
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Escolha a Bebida (Grátis)</h3>
              <RadioGroup value={selectedDrink} onValueChange={setSelectedDrink}>
                {drinkOptions.map((drink) => (
                  <div key={drink.id} className="flex items-center space-x-2 p-3 border rounded-lg">
                    <RadioGroupItem value={drink.id} id={drink.id} />
                    <Label htmlFor={drink.id} className="flex-1 cursor-pointer">
                      <div className="font-medium">{drink.name}</div>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
            <Separator />
          </>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Primeiro Sabor - Mostra apenas se não foi pré-selecionado */}
          {!preSelectedFlavor && (
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                🔥 {isComboFamilia ? 'Primeira Pizza' : 'Primeiro Sabor'}
                {selectedFlavor1 && (
                  <Badge className="ml-2 bg-brand-red">{selectedFlavor1.name}</Badge>
                )}
              </h3>
              
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {pizzas.map((pizza) => (
                  <Card 
                    key={pizza.id}
                    className={`cursor-pointer transition-all ${
                      selectedFlavor1?.id === pizza.id 
                        ? 'ring-2 ring-brand-red bg-brand-red/5' 
                        : 'hover:shadow-md'
                    }`}
                    onClick={() => { setSelectedFlavor1(pizza); }}
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-medium">{pizza.name}</h4>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {pizza.ingredients?.join(', ')}
                          </p>
                        </div>
                        <div className="text-right ml-4">
                          <span className="font-bold text-brand-red">
                            R$ {pizza.price.grande.toFixed(2).replace('.', ',')}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Primeiro Sabor Pré-selecionado - Apenas visualização */}
          {preSelectedFlavor && selectedFlavor1 && (
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                ✅ {isComboFamilia ? 'Primeira Pizza (Selecionada)' : 'Primeiro Sabor (Selecionado)'}
                <Badge className="ml-2 bg-brand-red">{selectedFlavor1.name}</Badge>
              </h3>
              
              <Card className="ring-2 ring-brand-red bg-brand-red/5">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-medium">{selectedFlavor1.name}</h4>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {selectedFlavor1.ingredients?.join(', ')}
                      </p>
                    </div>
                    <div className="text-right ml-4">
                      <span className="font-bold text-brand-red">
                        R$ {selectedFlavor1.price.grande.toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Segundo Sabor */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              🔥 {isComboFamilia 
                ? 'Segunda Pizza' 
                : (preSelectedFlavor ? 'Escolha o Segundo Sabor' : 'Segundo Sabor')
              }
              {selectedFlavor2 && (
                <Badge className="ml-2 bg-brand-orange">{selectedFlavor2.name}</Badge>
              )}
            </h3>
            
            <div ref={sabor2Ref} className="space-y-3 max-h-96 overflow-y-auto">
              {pizzas.map((pizza) => {
                const isAlreadySelected = selectedFlavor1?.id === pizza.id;
                return (
                  <Card
                    key={pizza.id}
                    onClick={() => {
                      if (isAlreadySelected) return;
                      setSelectedFlavor2(pizza);
                    }}
                    className={cn(
                      `relative cursor-pointer transition-all`,
                      isAlreadySelected && `opacity-50 cursor-not-allowed`,
                      !isAlreadySelected && selectedFlavor2?.id === pizza.id && `ring-2 ring-brand-orange bg-brand-orange/5`,
                      !isAlreadySelected && `hover:shadow-md`
                    )}
                  >
                    {isAlreadySelected && (
                      <div className="absolute inset-0 bg-gray-900/10 flex items-center justify-center rounded-lg z-10">
                        <Badge variant="secondary" className="text-xs">
                          Já selecionado
                        </Badge>
                      </div>
                    )}

                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-medium">{pizza.name}</h4>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {pizza.ingredients?.join(', ')}
                          </p>
                        </div>
                        <div className="text-right ml-4">
                          <span className="font-bold text-brand-orange">
                            R$ {pizza.price.grande.toFixed(2).replace('.', ',')}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>

        {/* Resumo e Checkout */}
        {selectedFlavor1 && selectedFlavor2 && (
          <>
            <Separator />
            <div className="bg-gradient-accent p-6 rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="font-semibold text-lg">
                    {isComboContext 
                      ? (isComboFamilia ? 'Seu Combo Família' : 'Seu Combo com Pizza Meio a Meio')
                      : 'Sua Pizza Meio a Meio'
                    }
                  </h4>
                  <p className="text-muted-foreground">
                    {selectedFlavor1.name} + {selectedFlavor2.name}
                    {isComboContext && selectedDrink && (
                      <span> + {products.find(p => p.id === selectedDrink)?.name}</span>
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-brand-red">
                    {isComboContext 
                      ? `R$ ${combo?.price.grande.toFixed(2).replace('.', ',')}` 
                      : `R$ ${calculatePrice().toFixed(2).replace('.', ',')}`
                    }
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {isComboContext 
                      ? (isComboFamilia ? '2 Pizzas + Borda Requeijão + Refrigerante 2L' : '1 Pizza + Borda Requeijão + Refrigerante 2L')
                      : 'Preço do sabor mais caro'
                    }
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-brand-red/10 p-3 rounded">
                  <div className="font-medium text-brand-red">{selectedFlavor1.name}</div>
                  <div className="text-xs text-muted-foreground">
                    R$ {selectedFlavor1.price.grande.toFixed(2).replace('.', ',')}
                  </div>
                </div>
                <div className="bg-brand-orange/10 p-3 rounded">
                  <div className="font-medium text-brand-orange">{selectedFlavor2.name}</div>
                  <div className="text-xs text-muted-foreground">
                    R$ {selectedFlavor2.price.grande.toFixed(2).replace('.', ',')}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        <div className="flex gap-3 pt-4">
          <Button variant="outline" onClick={handleClose} className="flex-1">
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={!selectedFlavor1 || !selectedFlavor2 || (isComboContext && !selectedDrink)}
            className="flex-1 bg-gradient-primary"
          >
            {isComboContext 
              ? `Adicionar ao Carrinho - R$ ${combo?.price.grande.toFixed(2).replace('.', ',')}` 
              : `Adicionar ao Carrinho - R$ ${calculatePrice().toFixed(2).replace('.', ',')}`
            }
          </Button>
        </div>
        <div className="pt-4">
          <DevelopedBy />
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default HalfPizzaModal;
