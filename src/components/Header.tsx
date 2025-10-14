import { ShoppingCart, Clock, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useEstablishment } from "@/hooks/useEstablishment";

interface HeaderProps {
  cartItemsCount: number;
  onCartClick: () => void;
}

const Header = ({ cartItemsCount, onCartClick }: HeaderProps) => {
  const { settings } = useEstablishment();
  return (
    <header className="sticky top-0 z-50 bg-gradient-primary shadow-elevated">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <>
              <img
                src="/logotipoaezap.ico"
                alt="Logo"
                className="w-12 h-12 rounded-full object-cover border-2 border-brand-gold"
                onError={(e) => {
                  const img = e.currentTarget as HTMLImageElement;
                  if (settings.logo) img.src = settings.logo as string;
                }}
              />
              <div className="text-white">
                <h1 className="text-2xl font-bold">{settings.name}</h1>
              </div>
            </>
          </div>
          
          <Button
            onClick={onCartClick}
            size="lg"
            className="relative bg-gradient-dark hover:opacity-90 text-white border border-brand-orange hover:border-brand-gold transition-all duration-300"
          >
            <ShoppingCart className="w-5 h-5 mr-2" />
            Carrinho
            {cartItemsCount > 0 && (
              <Badge className="absolute -top-2 -right-2 bg-brand-gold text-white min-w-[1.5rem] h-6 rounded-full p-0 flex items-center justify-center">
                {cartItemsCount}
              </Badge>
            )}
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;