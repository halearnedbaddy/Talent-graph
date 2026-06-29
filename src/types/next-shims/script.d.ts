import type React from 'react';
interface ScriptProps extends Omit<React.HTMLAttributes<HTMLScriptElement>, 'onLoad' | 'onError'> {
  src?: string;
  strategy?: 'beforeInteractive' | 'afterInteractive' | 'lazyOnload' | 'worker';
  onLoad?: () => void;
  onReady?: () => void;
  onError?: (e: Error) => void;
  id?: string;
  children?: React.ReactNode;
  nonce?: string;
}
declare const Script: React.FC<ScriptProps>;
export default Script;
