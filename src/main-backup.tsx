import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'

// Simple test component
function TestApp() {
    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            fontFamily: 'Arial, sans-serif'
        }}>
            <div style={{
                background: 'white',
                padding: '3rem',
                borderRadius: '20px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                textAlign: 'center'
            }}>
                <h1 style={{ color: '#667eea', fontSize: '2.5rem', marginBottom: '1rem' }}>
                    ✅ React يعمل بنجاح!
                </h1>
                <p style={{ color: '#666', fontSize: '1.2rem' }}>
                    التطبيق يعمل الآن. سأقوم بإصلاح المشكلة...
                </p>
            </div>
        </div>
    )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <TestApp />
    </React.StrictMode>,
)
