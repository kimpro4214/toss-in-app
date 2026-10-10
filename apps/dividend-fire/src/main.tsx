import React from 'react';
import ReactDOM from 'react-dom/client';
import { TDSMobileProvider, ThemeProvider } from '@toss/tds-mobile';
import { TDSMobileAITProvider } from '@toss/tds-mobile-ait';
import { native } from './platform';
import App from './App';
import './style.css';
const app = native ? <TDSMobileAITProvider brandPrimaryColor="#147d73"><App /></TDSMobileAITProvider> : <TDSMobileProvider userAgent={{ isAndroid: /Android/.test(navigator.userAgent), isIOS: /iPhone|iPad/.test(navigator.userAgent), fontA11y: undefined, fontScale: undefined }}><ThemeProvider token={{ color:{ primary:'#147d73' } }}><App /></ThemeProvider></TDSMobileProvider>;
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode>{app}</React.StrictMode>);
