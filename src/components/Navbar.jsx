import React from 'react';
import './Navbar.css';
import { FaGithub, FaInstagram } from "react-icons/fa";


const Navbar = () => (
  <nav className="navbar">
    <div className="logo">
      <h1>Youtube 
      </h1>
      <img className='logo-img' src="/logo.png" alt="" />  
      <h1>Özetleyici</h1>
    </div>
    <div className="social">
      <a target='_blank' href="https://github.com/nkarimzade"><FaGithub /></a>
      <a target='_blank' href="https://instagram.com/nkrmv"><FaInstagram /></a>
    </div>
  </nav>
);

export default Navbar; 