import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useEstablishment } from '../../../hooks/useEstablishment';

interface EstablishmentSettings {
  name: string;
  logo?: string;
  // deliveryTime, pickupTime and paymentMethods were removed per request
}

const EstablishmentSettings = () => {
  const { settings, updateSettings } = useEstablishment();
  const [editedSettings, setEditedSettings] = React.useState<EstablishmentSettings>(settings);

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditedSettings(prev => ({ ...prev, logo: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    updateSettings(editedSettings);
    // If a dataUrl logo was provided, POST it to server so the PWA manifest can use it
    if (editedSettings.logo && editedSettings.logo.startsWith('data:')) {
      fetch('/api/admin/logo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl: editedSettings.logo })
      }).then(() => {
        // no-op; if it fails, server logs will show it
      }).catch((e) => console.warn('Failed to upload logo to server', e));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configurações do Estabelecimento</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Nome
            </Label>
            <Input
              id="name"
              value={editedSettings.name}
              className="col-span-3"
              onChange={(e) =>
                setEditedSettings((prev) => ({ ...prev, name: e.target.value }))
              }
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="logo" className="text-right">
              Logo
            </Label>
            <div className="col-span-3 flex items-center gap-4">
              {editedSettings.logo && (
                <img 
                  src={editedSettings.logo} 
                  alt="Logo Preview" 
                  className="w-12 h-12 rounded-full object-cover border-2 border-brand-gold"
                />
              )}
              <Input
                id="logo"
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="col-span-3"
              />
            </div>
          </div>

          {/* deliveryTime, pickupTime and paymentMethods fields removed */}

          <div className="flex justify-end">
            <Button onClick={handleSave}>Salvar Alterações</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default EstablishmentSettings;