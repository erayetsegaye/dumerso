'use client';

import React, { useState } from 'react';
import { getCategoryFallbackImage } from '@/lib/constants';

type SafeImageProps = Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src?: string | null;
  alt: string;
  categoryName?: string;
  className?: string;
};

export default function SafeImage({
  src,
  alt,
  categoryName,
  className = '',
  ...props
}: SafeImageProps) {
  const fallback = getCategoryFallbackImage(categoryName);
  const [imgSrc, setImgSrc] = useState<string>(src && src.trim() ? src : fallback);
  const [hasError, setHasError] = useState<boolean>(false);

  const handleError = () => {
    if (!hasError) {
      setHasError(true);
      setImgSrc(fallback);
    }
  };

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imgSrc}
      alt={alt}
      loading="lazy"
      onError={handleError}
      className={`object-cover ${className}`}
      {...props}
    />
  );
}
