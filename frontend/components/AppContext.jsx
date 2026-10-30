'use client';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { api, setToken, getToken, clearToken } from '../lib/api';
import ConfirmModal from './ConfirmModal';

const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

export function AppProvider({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [brandId, setBrandId] = useState('all'); // admin filter
  const [brands, setBrands] = useState([]);
  const [modalConfig, setModalConfig] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('oc_theme') || 'light';
      setTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);

      const savedCollapsed = localStorage.getItem('oc_sidebar_collapsed');
      if (savedCollapsed !== null) {
        setCollapsed(savedCollapsed === 'true');
      }
    }

    if (!getToken()) {
      setReady(true);
      if (pathname !== '/login') router.replace('/login');
      return;
    }
    api('/api/auth/me')
      .then((d) => { setUser(d.user); setReady(true); })
      .catch(() => { clearToken(); setReady(true); router.replace('/login'); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleCollapse = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('oc_sidebar_collapsed', String(next));
      }
      return next;
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const nextTheme = prev === 'dark' ? 'light' : 'dark';
      if (typeof window !== 'undefined') {
        localStorage.setItem('oc_theme', nextTheme);
        document.documentElement.setAttribute('data-theme', nextTheme);
      }
      return nextTheme;
    });
  }, []);

  const refreshBrands = useCallback(async () => {
    if (user?.role === 'admin' || user?.role === 'confirmer') {
      try {
        const d = await api('/api/brands');
        const list = d.brands || [];
        setBrands(list);
        return list;
      } catch (e) {
        return [];
      }
    }
    return [];
  }, [user]);

  useEffect(() => {
    refreshBrands();
  }, [refreshBrands]);

  const login = async (email, password, role) => {
    const d = await api('/api/auth/login', { method: 'POST', body: { email, password, role } });
    setToken(d.token);
    setUser(d.user);
    setBrandId('all');
    router.replace(d.user.role === 'confirmer' ? '/orders' : '/dashboard');
  };
  const logout = () => { clearToken(); setUser(null); router.replace('/login'); };

  const confirmDialog = useCallback(({
    title = 'Confirm Action',
    message = 'Are you sure you want to proceed?',
    detail = null,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'danger',
    icon = null,
  }) => {
    return new Promise((resolve) => {
      setModalConfig({
        isOpen: true,
        title,
        message,
        detail,
        confirmText,
        cancelText,
        variant,
        icon,
        isPrompt: false,
        onConfirm: () => {
          setModalConfig(null);
          resolve(true);
        },
        onCancel: () => {
          setModalConfig(null);
          resolve(false);
        },
      });
    });
  }, []);

  const promptDialog = useCallback(({
    title = 'Action Required',
    message = 'Please provide the required value:',
    detail = null,
    placeholder = '',
    defaultValue = '',
    inputType = 'text',
    confirmText = 'Save',
    cancelText = 'Cancel',
    variant = 'prompt',
    icon = '🔐',
  }) => {
    return new Promise((resolve) => {
      setModalConfig({
        isOpen: true,
        title,
        message,
        detail,
        confirmText,
        cancelText,
        variant,
        icon,
        isPrompt: true,
        promptPlaceholder: placeholder,
        promptDefaultValue: defaultValue,
        promptInputType: inputType,
        onConfirm: (val) => {
          setModalConfig(null);
          resolve(val);
        },
        onCancel: () => {
          setModalConfig(null);
          resolve(null);
        },
      });
    });
  }, []);

  // Brand users are always scoped to their own brand (server enforces it too).
  // Confirmers & Admin can filter by brandId if selected, or 'all' for all accessible brands.
  const brandParam =
    user?.role === 'brand' ? `&brand_id=${user.brand?.id}` :
    brandId !== 'all' ? `&brand_id=${brandId}` : '';

  const brandLabel =
    user?.role === 'brand' ? user.brand?.name :
    brandId === 'all' ? (user?.role === 'confirmer' ? 'Toutes mes marques' : 'All brands') :
    (brands.find((b) => String(b.id) === String(brandId))?.name || '');

  return (
    <AppCtx.Provider value={{ 
      user, 
      ready, 
      login, 
      logout, 
      brands, 
      brandId, 
      setBrandId, 
      brandParam, 
      brandLabel,
      refreshBrands,
      confirmDialog,
      promptDialog,
      collapsed,
      setCollapsed,
      toggleCollapse,
      theme,
      setTheme,
      toggleTheme
    }}>
      {children}
      {modalConfig && <ConfirmModal {...modalConfig} />}
    </AppCtx.Provider>
  );
}



