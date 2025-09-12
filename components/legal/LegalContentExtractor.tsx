"use client";

import { ReactNode } from 'react';

interface LegalContentExtractorProps {
  children: ReactNode;
}

/**
 * Legal Content Extractor
 * 
 * This component extracts just the content from legal pages
 * by removing the LegalPageWrapper and keeping only the inner content.
 * This allows us to reuse the same content in both full pages and modals.
 */
export function LegalContentExtractor({ children }: LegalContentExtractorProps) {
  // If the children is wrapped in LegalPageWrapper, extract just the content
  if (children && typeof children === 'object' && 'props' in children) {
    const childrenProps = (children as any).props;
    if (childrenProps && childrenProps.children) {
      return <>{childrenProps.children}</>;
    }
  }
  
  // Otherwise return children as-is
  return <>{children}</>;
}
