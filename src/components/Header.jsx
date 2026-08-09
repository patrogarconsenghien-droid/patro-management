import React from 'react';
import { ArrowLeft, Wifi, WifiOff } from 'lucide-react';

const Header = ({ title, onBack, loading, isOnline }) => (
  <div className="flex items-center justify-between p-4 bg-white shadow-sm">
    {onBack && (
      <button onClick={onBack} className="p-2 -ml-2 hover:bg-gray-100 rounded-full active:scale-95">
        <ArrowLeft size={20} />
      </button>
    )}
    <h1 className="text-lg font-semibold flex-1 text-center">{title}</h1>
    <div className="flex items-center space-x-2">
      {loading && (
        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      )}
      <div className={`p-1 rounded ${isOnline ? 'text-green-500' : 'text-red-500'}`}>
        {isOnline ? <Wifi size={16} /> : <WifiOff size={16} />}
      </div>
    </div>
  </div>
);

export default Header;
