
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error("Critical Error: Root element not found");
} else {
  try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (error) {
    console.error("React Mounting Error:", error);
    rootElement.innerHTML = `
      <div style="color: white; padding: 20px; text-align: center; font-family: sans-serif;">
        <h2>عذراً، حدث خطأ أثناء تحميل اللعبة</h2>
        <p style="color: #ff4444;">${error instanceof Error ? error.message : 'خطأ غير معروف'}</p>
        <button onclick="window.location.reload()" style="padding: 10px 20px; background: #3b82f6; color: white; border: none; border-radius: 5px; cursor: pointer;">إعادة المحاولة</button>
      </div>
    `;
  }
}
