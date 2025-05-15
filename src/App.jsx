import React from 'react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import VideoToPdf from './components/VideoToPdf';
import './App.css'

function App() {
  return (
    <>
      <Navbar />
      <main>
        <VideoToPdf />
      </main>
      <Footer />
    </>
  );
}

export default App;
