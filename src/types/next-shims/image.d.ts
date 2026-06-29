import type React from 'react';
interface StaticImageData { src: string; height: number; width: number; blurDataURL?: string; }
interface ImageProps {
  src: string | StaticImageData;
  alt: string;
  width?: number | `${number}`;
  height?: number | `${number}`;
  fill?: boolean;
  loader?: (p: { src: string; width: number; quality?: number }) => string;
  quality?: number | `${number}`;
  priority?: boolean;
  loading?: 'eager' | 'lazy';
  placeholder?: 'blur' | 'empty' | `data:image/${string}`;
  blurDataURL?: string;
  unoptimized?: boolean;
  onLoad?: React.ReactEventHandler<HTMLImageElement>;
  onError?: React.ReactEventHandler<HTMLImageElement>;
  sizes?: string;
  style?: React.CSSProperties;
  className?: string;
  decoding?: 'sync' | 'async' | 'auto';
}
declare const Image: React.ForwardRefExoticComponent<ImageProps & React.RefAttributes<HTMLImageElement>>;
export default Image;
