import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import AdSearch from './pages/AdSearch';
import AdDetails from './pages/AdDetails';
import SuccessPatterns from './pages/SuccessPatterns';
import Header from './components/Header';
import Footer from './components/Footer';
import './App.css';

function App() {
  return (
    <Router>
      <div className="app-container">
        <Header />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/search" element={<AdSearch />} />
            <Route path="/ad/:adId" element={<AdDetails />} />
            <Route path="/patterns" element={<SuccessPatterns />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
}

export default App;