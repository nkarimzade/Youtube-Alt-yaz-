import React from 'react';
import './Navbar.css';
import { FaGithub, FaInstagram } from "react-icons/fa";


const Navbar = () => (
  <nav className="navbar">
    <div className="logo">
      <h1>Youtube <span>Video</span> Özetleyici
      </h1>
    </div>
    <div className="social">
      <a href="#"><FaGithub /></a>
      <a href="#"><FaInstagram /></a>
    </div>
  </nav>
);

export default Navbar; 