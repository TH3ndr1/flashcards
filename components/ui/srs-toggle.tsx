// components/ui/srs-toggle.tsx
"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface SrsToggleProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
  id?: string;
}

/**
 * Reusable SRS toggle component used across practice pages.
 * Provides consistent styling and behavior for SRS scheduling toggle.
 */
export function SrsToggle({ 
  checked, 
  onCheckedChange, 
  className = "",
  id = "srs-enabled" 
}: SrsToggleProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Checkbox 
        id={id} 
        checked={checked} 
        onCheckedChange={(value) => onCheckedChange(!!value)} 
      />
      <Label htmlFor={id} className="cursor-pointer">
        Use SRS scheduling
      </Label>
    </div>
  );
}
