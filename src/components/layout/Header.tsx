import React from 'react';
import { Button } from '../ui/Button';

interface HeaderProps {
  onSave?: () => void;
  onLoad?: () => void;
  onNew?: () => void;
  title?: string;
}

export function Header({ onSave, onLoad, onNew, title = 'Vitruvius Modeler' }: HeaderProps) {
  return (
    <header style={{
      height: 60,
      background: '#2c3e50',
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 20px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      position: 'absolute',
      top: 0,
      left: 180,
      right: 0,
      zIndex: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>{title}</h1>
      </div>
      
    </header>
  );
} 