'use client';

import React from 'react';
import { CrossDeviceClipboard, copyText } from './CrossDeviceClipboard';

interface QuickPastePCProps {
  initialCode?: string;
}

export function copyToClipboard(text: string): Promise<boolean> {
  return copyText(text);
}

export const QuickPastePC: React.FC<QuickPastePCProps> = ({ initialCode }) => {
  return <CrossDeviceClipboard initialCode={initialCode} />;
};
