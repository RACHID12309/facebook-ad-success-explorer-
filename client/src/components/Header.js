import React from 'react';
import { Link } from 'react-router-dom';

function Header() {
  return (
    <header className="bg-gradient-to-r from-blue-700 to-indigo-900 text-white shadow-md">
      <div className="container mx-auto p-4">
        <div className="flex justify-between items-center">
          <Link to="/" className="text-2xl font-bold">Facebook Ad Success Explorer</Link>
          
          <nav className="hidden md:block">
            <ul className="flex space-x-6">
              <li><Link to="/" className="hover:text-blue-200">Home</Link></li>
              <li><Link to="/search" className="hover:text-blue-200">Ad Search</Link></li>
              <li><Link to="/patterns" className="hover:text-blue-200">Success Patterns</Link></li>
            </ul>
          </nav>
          
          <div>
            <Link to="/search" className="bg-white text-blue-700 hover:bg-blue-100 px-4 py-2 rounded-lg font-medium">
              Start Search
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
