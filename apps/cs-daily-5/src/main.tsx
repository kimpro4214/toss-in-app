import React from 'react';
import ReactDOM from 'react-dom/client';
import { TDSMobileProvider } from '@toss/tds-mobile';
import { TDSMobileAITProvider } from '@toss/tds-mobile-ait';
import { native } from './platform';
import { App } from './App';
import './style.css';
import './preferences.css';

const application = native ? <TDSMobileAITProvider brandPrimaryColor="#3182f6"><App/></TDSMobileAITProvider> : <TDSMobileProvider userAgent={{ isAndroid: /Android/.test(navigator.userAgent), isIOS: /iPhone|iPad/.test(navigator.userAgent), fontA11y: undefined, fontScale: undefined }}><App/></TDSMobileProvider>;
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode>{application}</React.StrictMode>);
