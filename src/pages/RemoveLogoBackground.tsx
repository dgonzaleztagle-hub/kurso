import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { removeBackground, loadImage } from "@/utils/removeBackground";
import logoOriginal from "@/assets/logo-santa-cruz.png";

export default function RemoveLogoBackground() {
  const [processing, setProcessing] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const processLogo = async () => {
    setProcessing(true);
    try {
      // Load the original logo
      const response = await fetch(logoOriginal);
      const blob = await response.blob();
      const img = await loadImage(blob);
      
      // Remove background
      const resultBlob = await removeBackground(img);
      const url = URL.createObjectURL(resultBlob);
      setResultUrl(url);
      
      // Download the result
      const a = document.createElement('a');
      a.href = url;
      a.download = 'logo-colegio-sin-fondo.png';
      a.click();
      
      toast.success("Fondo removido exitosamente. Imagen descargada.");
    } catch (error) {
      console.error("Error:", error);
      toast.error("Error al remover el fondo");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Remover Fondo del Logo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium mb-2">Original</p>
              <img src={logoOriginal} alt="Logo original" className="w-full max-w-xs border" />
            </div>
            {resultUrl && (
              <div>
                <p className="text-sm font-medium mb-2">Sin fondo</p>
                <img src={resultUrl} alt="Logo sin fondo" className="w-full max-w-xs border" />
              </div>
            )}
          </div>
          
          <Button onClick={processLogo} disabled={processing}>
            {processing ? "Procesando..." : "Remover Fondo Blanco"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
