
import React from 'react';
import { Loader2 } from 'lucide-react';

export const LoadingScreen: React.FC = () => {
  return (
    <div className="flex items-center justify-center min-h-[400px] w-full h-full">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
      </div>
    </div>
  );
};
