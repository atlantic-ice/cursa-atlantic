const PROD_API_BASE = 'https://cursa.onrender.com';
const LOCAL_API_BASE = process.env.REACT_APP_LOCAL_API_BASE || 'http://127.0.0.1:5000';

const sanitizeBase = (value) => (value || '').replace(/\/$/, '');

export const resolveApiBase = () => {
  const envBase = process.env.REACT_APP_API_BASE;
  if (envBase) {
    return sanitizeBase(envBase);
  }

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname || '';
    const isLocalhost = ['localhost', '127.0.0.1', '::1'].includes(hostname);
    const isDevTld = hostname.endsWith('.local');
    if (isLocalhost || isDevTld) {
      return sanitizeBase(LOCAL_API_BASE);
    }
  }

  return sanitizeBase(PROD_API_BASE);
};

const API_BASE = resolveApiBase();

export default API_BASE;
