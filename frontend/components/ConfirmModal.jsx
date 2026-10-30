'use client';
import React, { useState, useEffect, useRef } from 'react';

export default function ConfirmModal({
  isOpen,
  title = 'Confirmation',
  message = 'Veuillez confirmer cette action :',
  detail = null,
  confirmText = 'Confirmer',
  cancelText = 'Annuler',
  variant = 'prompt', // 'danger' | 'warning' | 'brand' | 'prompt'
  icon = null,
  isPrompt = false,
  promptPlaceholder = 'Entrez votre mot de passe...',
  promptDefaultValue = '',
  promptInputType = 'password',
  onConfirm,
  onCancel,
}) {
  const [inputValue, setInputValue] = useState(promptDefaultValue || '');
  const [showPassword, setShowPassword] = useState(false);
  const [inputError, setInputError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setInputValue(promptDefaultValue || '');
      setInputError('');
      setShowPassword(false);
      const timer = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [isOpen, promptDefaultValue, isPrompt]);

  const handleConfirmClick = () => {
    if (isPrompt) {
      if (!inputValue || !inputValue.trim()) {
        setInputError('Le mot de passe administrateur est requis.');
        inputRef.current?.focus();
        return;
      }
      onConfirm(inputValue.trim());
    } else {
      onConfirm();
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleConfirmClick();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, inputValue, isPrompt, onCancel]);

  if (!isOpen) return null;

  const defaultIcons = {
    danger: '🗑️',
    warning: '⚠️',
    brand: '✨',
    prompt: '🔐',
  };

  const currentIcon = icon || defaultIcons[variant] || '🔐';

  return (
    <div 
      className="modal-overlay" 
      onClick={onCancel}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.35)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999999,
        padding: 16,
      }}
    >
      <div 
        className={`modal-card modal-variant-${variant}`} 
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        style={{
          backgroundColor: 'var(--card, #131b2e)',
          color: 'var(--ink, #f8fafc)',
          borderRadius: '16px',
          border: '1px solid var(--card-border, #1e293b)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
          maxWidth: 480,
          width: '100%',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '24px 24px 18px 24px' }}>
          
          {/* Header Row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
            <div 
              style={{
                width: 44,
                height: 44,
                borderRadius: '12px',
                backgroundColor: variant === 'danger' ? 'rgba(244, 63, 94, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                border: variant === 'danger' ? '1px solid rgba(244, 63, 94, 0.35)' : '1px solid rgba(99, 102, 241, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                flexShrink: 0,
              }}
            >
              {currentIcon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 4px 0', color: 'var(--ink, #f8fafc)' }}>
                {title}
              </h3>
              <p style={{ fontSize: 13.5, color: 'var(--ink-muted, #94a3b8)', margin: 0, lineHeight: 1.4 }}>
                {message}
              </p>
            </div>
          </div>

          {/* Detail Box */}
          {detail && (
            <div 
              style={{
                backgroundColor: 'var(--bg-secondary, #0f172a)',
                border: '1px solid var(--card-border, #1e293b)',
                borderRadius: '10px',
                padding: '12px 14px',
                marginBottom: 16,
              }}
            >
              {detail}
            </div>
          )}

          {/* Password / Prompt Input */}
          {isPrompt && (
            <div style={{ marginTop: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink-muted, #94a3b8)', marginBottom: 6 }}>
                Mot de passe administrateur :
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  ref={inputRef}
                  type={promptInputType === 'password' && showPassword ? 'text' : promptInputType}
                  placeholder={promptPlaceholder || 'Entrez votre mot de passe...'}
                  value={inputValue}
                  onChange={(e) => {
                    setInputValue(e.target.value);
                    if (inputError) setInputError('');
                  }}
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '11px 44px 11px 14px',
                    fontSize: 14.5,
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg, #090d16)',
                    color: 'var(--ink, #f8fafc)',
                    border: inputError ? '1.5px solid var(--red, #f43f5e)' : '1px solid var(--card-border, #334155)',
                    outline: 'none',
                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.2)',
                  }}
                />
                {promptInputType === 'password' && (
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    style={{
                      position: 'absolute',
                      right: 10,
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 16,
                      padding: 4,
                      color: 'var(--ink-muted, #94a3b8)',
                      opacity: 0.85,
                    }}
                    title={showPassword ? 'Masquer' : 'Afficher'}
                  >
                    {showPassword ? '👁️' : '🔒'}
                  </button>
                )}
              </div>
              {inputError && (
                <div style={{ color: 'var(--red, #f43f5e)', fontSize: 12, fontWeight: 600, marginTop: 6 }}>
                  ⚠️ {inputError}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div 
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            padding: '14px 24px',
            backgroundColor: 'var(--bg-secondary, #0f172a)',
            borderTop: '1px solid var(--card-border, #1e293b)',
          }}
        >
          <button 
            type="button" 
            className="btn ghost" 
            onClick={onCancel}
            style={{ fontSize: 13, padding: '8px 16px' }}
          >
            {cancelText}
          </button>
          <button 
            type="button" 
            className={`btn ${variant === 'danger' ? 'danger' : ''}`} 
            onClick={handleConfirmClick}
            style={{
              fontSize: 13,
              fontWeight: 700,
              padding: '8px 18px',
              backgroundColor: variant === 'danger' ? '#f43f5e' : undefined,
            }}
          >
            {confirmText}
          </button>
        </div>

      </div>
    </div>
  );
}

