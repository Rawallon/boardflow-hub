import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Palette, Image, X } from 'lucide-react';

interface Board {
  id: string;
  title: string;
  description: string | null;
  background_color: string | null;
  background_image_url: string | null;
  background_image_scale: string | null;
}

interface BoardCustomizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  board: Board | null;
  onSave: (customization: {
    background_color: string | null;
    background_image_url: string | null;
    background_image_scale: string | null;
  }) => Promise<void>;
}

const BACKGROUND_SCALE_OPTIONS = [
  { value: 'cover', label: 'Cover (Fill entire area)' },
  { value: 'contain', label: 'Contain (Fit within area)' },
  { value: 'stretch', label: 'Stretch (Fill by stretching)' },
  { value: 'repeat', label: 'Repeat (Tile the image)' },
  { value: 'center', label: 'Center (No scaling)' },
];

const PRESET_COLORS = [
  '#ffffff', '#f8f9fa', '#e9ecef', '#dee2e6',
  '#ced4da', '#adb5bd', '#6c757d', '#495057',
  '#343a40', '#212529', '#007bff', '#6610f2',
  '#6f42c1', '#e83e8c', '#dc3545', '#fd7e14',
  '#ffc107', '#28a745', '#20c997', '#17a2b8',
  '#6f42c1', '#e83e8c', '#dc3545', '#fd7e14'
];

export function BoardCustomizationDialog({
  open,
  onOpenChange,
  board,
  onSave,
}: BoardCustomizationDialogProps) {
  const [backgroundColor, setBackgroundColor] = useState(board?.background_color || '');
  const [backgroundImageUrl, setBackgroundImageUrl] = useState(board?.background_image_url || '');
  const [backgroundImageScale, setBackgroundImageScale] = useState(board?.background_image_scale || 'cover');
  const [customColor, setCustomColor] = useState('');

  const handleSave = async () => {
    await onSave({
      background_color: backgroundColor || null,
      background_image_url: backgroundImageUrl || null,
      background_image_scale: backgroundImageScale,
    });
    onOpenChange(false);
  };

  const handlePresetColorClick = (color: string) => {
    setBackgroundColor(color);
    setCustomColor('');
  };

  const handleCustomColorChange = (color: string) => {
    setCustomColor(color);
    if (color) {
      setBackgroundColor(color);
    }
  };

  const clearBackground = () => {
    setBackgroundColor('');
    setBackgroundImageUrl('');
    setCustomColor('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Customize Board Appearance
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Background Color Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              <Label className="text-base font-medium">Background Color</Label>
            </div>
            
            {/* Preset Colors */}
            <div>
              <Label className="text-sm text-muted-foreground mb-2 block">Preset Colors</Label>
              <div className="grid grid-cols-8 gap-2">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`w-8 h-8 rounded border-2 transition-all hover:scale-110 ${
                      backgroundColor === color ? 'border-primary ring-2 ring-primary/20' : 'border-gray-300'
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => handlePresetColorClick(color)}
                    title={color}
                  />
                ))}
              </div>
            </div>

            {/* Custom Color Input */}
            <div>
              <Label htmlFor="custom-color" className="text-sm text-muted-foreground mb-2 block">
                Custom Color
              </Label>
              <div className="flex gap-2">
                <Input
                  id="custom-color"
                  type="color"
                  value={customColor}
                  onChange={(e) => handleCustomColorChange(e.target.value)}
                  className="w-16 h-10 p-1 border rounded"
                />
                <Input
                  placeholder="#ffffff"
                  value={backgroundColor}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>
          </div>

          {/* Background Image Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Image className="h-4 w-4" />
              <Label className="text-base font-medium">Background Image</Label>
            </div>
            
            <div>
              <Label htmlFor="image-url" className="text-sm text-muted-foreground mb-2 block">
                Image URL
              </Label>
              <Input
                id="image-url"
                placeholder="https://example.com/image.jpg"
                value={backgroundImageUrl}
                onChange={(e) => setBackgroundImageUrl(e.target.value)}
              />
            </div>

            {backgroundImageUrl && (
              <div>
                <Label htmlFor="image-scale" className="text-sm text-muted-foreground mb-2 block">
                  Image Scaling
                </Label>
                <Select value={backgroundImageScale} onValueChange={setBackgroundImageScale}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BACKGROUND_SCALE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Preview Section */}
          {(backgroundColor || backgroundImageUrl) && (
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Preview</Label>
              <div 
                className="h-32 rounded-lg border-2 border-dashed border-gray-300 relative overflow-hidden"
                style={{
                  backgroundColor: backgroundColor || undefined,
                  backgroundImage: backgroundImageUrl ? `url(${backgroundImageUrl})` : undefined,
                  backgroundSize: backgroundImageScale === 'cover' ? 'cover' :
                                 backgroundImageScale === 'contain' ? 'contain' :
                                 backgroundImageScale === 'stretch' ? '100% 100%' :
                                 backgroundImageScale === 'repeat' ? 'auto' :
                                 backgroundImageScale === 'center' ? 'auto' : 'cover',
                  backgroundRepeat: backgroundImageScale === 'repeat' ? 'repeat' : 'no-repeat',
                  backgroundPosition: backgroundImageScale === 'center' ? 'center' : 'center',
                }}
              >
                <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                  Board Preview
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={clearBackground}
              className="flex items-center gap-2"
            >
              <X className="h-4 w-4" />
              Clear Background
            </Button>
            
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleSave}>
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
