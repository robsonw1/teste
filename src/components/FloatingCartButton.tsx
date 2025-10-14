import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface FloatingCartButtonProps {
  itemCount: number;
  onClick: () => void;
}

const FloatingCartButton = ({ itemCount, onClick }: FloatingCartButtonProps) => {
  if (itemCount === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Button
        onClick={onClick}
        size="lg"
        className="relative h-16 w-16 rounded-full bg-gradient-primary shadow-elevated animate-pulse hover:animate-none transition-all duration-300 hover:scale-110"
      >
        <ShoppingCart className="h-8 w-8 text-white" />
        {itemCount > 0 && (
          <Badge 
            variant="destructive" 
            className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0 flex items-center justify-center text-xs font-bold bg-brand-red border-2 border-white"
          >
            {itemCount > 99 ? '99+' : itemCount}
          </Badge>
        )}
      </Button>
    </div>
  );
};

export default FloatingCartButton;