import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Chat from './pages/Chat';
import SecurityLogs from './pages/SecurityLogs';
import AttackDemo from './pages/AttackDemo';
import KeyExchangeTest from './components/KeyExchangeTest';
import './App.css';

function App() {
  // Simple auth check - will be improved in Phase 2
  const isAuthenticated = () => {
    return localStorage.getItem('token') !== null;
  };

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route 
          path="/chat" 
          element={isAuthenticated() ? <Chat /> : <Navigate to="/login" />} 
        />
        <Route 
          path="/test-key-exchange" 
          element={isAuthenticated() ? <KeyExchangeTest /> : <Navigate to="/login" />} 
        />
        <Route 
          path="/security-logs" 
          element={isAuthenticated() ? <SecurityLogs /> : <Navigate to="/login" />} 
        />
        <Route 
          path="/attack-demo" 
          element={isAuthenticated() ? <AttackDemo /> : <Navigate to="/login" />} 
        />
        <Route path="/" element={<Navigate to="/login" />} />
      </Routes>
    </Router>
  );
}

export default App;
