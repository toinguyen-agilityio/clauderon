import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@xyflow/react/dist/style.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Clauderon',
  description: 'Run GitHub issues through Flows on each Member’s Pod.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
