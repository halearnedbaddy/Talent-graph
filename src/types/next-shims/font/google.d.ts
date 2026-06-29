interface FontOptions {
  weight?: string | string[];
  style?: string | string[];
  subsets?: string[];
  display?: 'auto' | 'block' | 'swap' | 'fallback' | 'optional';
  variable?: string;
  preload?: boolean;
  fallback?: string[];
  adjustFontFallback?: boolean | string;
}
interface NextFont {
  className: string;
  style: { fontFamily: string; fontWeight?: number; fontStyle?: string };
  variable: string;
}
type FontFn = (options: FontOptions) => NextFont;
export declare const Inter: FontFn;
export declare const Roboto: FontFn;
export declare const Open_Sans: FontFn;
export declare const Lato: FontFn;
export declare const Montserrat: FontFn;
export declare const Poppins: FontFn;
export declare const Raleway: FontFn;
export declare const Source_Sans_3: FontFn;
export declare const Nunito: FontFn;
export declare const Playfair_Display: FontFn;
export declare const Merriweather: FontFn;
export declare const DM_Sans: FontFn;
export declare const Plus_Jakarta_Sans: FontFn;
export declare const Space_Grotesk: FontFn;
export declare const Geist: FontFn;
export declare const Geist_Mono: FontFn;
export declare const Noto_Sans: FontFn;
export declare const Ubuntu: FontFn;
export declare const Oswald: FontFn;
export declare const Barlow: FontFn;
