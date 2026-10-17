import React from 'react';
import ReactDOM from 'react-dom/client';
import { TDSMobileProvider } from '@toss/tds-mobile';
import { TDSMobileAITProvider } from '@toss/tds-mobile-ait';
import { App } from './App';
import { native } from './platform';
import './style.css';
const app = native
  ? <TDSMobileAITProvider brandPrimaryColor="#76513C"><App /></TDSMobileAITProvider>
  : <TDSMobileProvider userAgent={{ isAndroid: /Android/.test(navigator.userAgent), isIOS: /iPhone|iPad/.test(navigator.userAgent), fontA11y: undefined, fontScale: undefined }}><App /></TDSMobileProvider>;
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode>{app}</React.StrictMode>);
