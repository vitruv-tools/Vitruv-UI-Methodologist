import React from 'react';

interface KitLogoIconProps {
  className?: string;
}

/** KIT emblem from Wikimedia Commons (Logo_KIT.svg), white on button background. */
export function KitLogoIcon({ className }: Readonly<KitLogoIconProps>) {
  return (
    <img
      className={className}
      src={`${process.env.PUBLIC_URL}/assets/kit-logo.svg`}
      alt=""
      draggable={false}
    />
  );
}
