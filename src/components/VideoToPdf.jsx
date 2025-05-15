import React, { useState, useRef } from 'react';
import { Youtube, FileText, Share2, Loader2, Info, BarChart2, Calendar } from 'lucide-react';
import ReactPlayer from 'react-player';
import './VideoToPdf.css';

const VideoToPdf = () => {
  const [videoUrl, setVideoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [videoInfo, setVideoInfo] = useState(null);
  const [recentVideos, setRecentVideos] = useState([]);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const shareMenuRef = useRef();

  // İstatistikler için örnek veri
  const totalSummarized = 42 + recentVideos.length;
  const lastSummaryDate = recentVideos[0]?.date || new Date().toLocaleDateString('tr-TR');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('http://localhost:5000/api/video-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: videoUrl }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Video bilgileri alınamadı');
      }

      const infoData = await response.json();
      setVideoInfo({ ...infoData, url: videoUrl });
      setRecentVideos(prev => [{ ...infoData, url: videoUrl, date: new Date().toLocaleDateString('tr-TR') }, ...prev].slice(0, 3));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePdfDownload = async () => {
    if (!videoInfo || !videoInfo.url) return;
    setPdfLoading(true);
    setError('');
    try {
      const response = await fetch('http://localhost:5000/api/create-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: videoInfo.url }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'PDF oluşturulamadı');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${videoInfo.title || 'video-ozet'}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err.message);
    } finally {
      setPdfLoading(false);
    }
  };

  const handleShare = () => {
    setShareOpen(!shareOpen);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="vtp-container">
      <h1 className="vtp-title">YouTube Video Özetleyici</h1>
      <div className="vtp-desc">
        <Info size={18} /> Yapay zekayla saniyeler içinde video özeti ve altyazı!
      </div>
      <div className="vtp-stats">
        <span><BarChart2 size={16} /> Toplam özetlenen: <b>{totalSummarized}</b></span>
        <span><Calendar size={16} /> Son özet: <b>{lastSummaryDate}</b></span>
      </div>
      <form onSubmit={handleSubmit} className="vtp-form">
        <div className="flex">
          <div className="input-group">
            <Youtube size={22} />
            <input
              type="text"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="YouTube video URL'sini yapıştırın"
            />
          </div>
          <button type="submit" className="button-main" disabled={loading}>
            {loading ? <Loader2 className="spin" size={20} /> : 'Özetle'}
          </button>
        </div>
      </form>

      <div className="vtp-how">
        <b>Nasıl Çalışır?</b>
        <ol>
          <li>🔗 YouTube linkini yapıştır</li>
          <li>⚡ Özetle butonuna tıkla</li>
          <li>📄 PDF indir ve paylaş</li>
        </ol>
      </div>

      {error && <div className="error-message">{error}</div>}

      {videoInfo && (
        <div className="vtp-detail">
          <div className="vtp-player">
            <ReactPlayer url={videoInfo.url} width="100%" height="320px" controls />
          </div>
          <div className="vtp-summary">
            <h2>{videoInfo.title}</h2>
            <p className="vtp-author">{videoInfo.author}</p>
            <div className="vtp-summary-btns">
              <button className="button-main" onClick={handlePdfDownload} disabled={pdfLoading} type="button">
                {pdfLoading ? <Loader2 className="spin" size={18} /> : <FileText size={18} />} PDF İndir
              </button>
              <div style={{ position: 'relative' }}>
                <button className="button-secondary" type="button" onClick={handleShare}>
                  <Share2 size={18} /> Paylaş
                </button>
                {shareOpen && (
                  <div className="share-menu" ref={shareMenuRef}>
                    <a href={`https://wa.me/?text=${encodeURIComponent(window.location.href)}`} target="_blank" rel="noopener noreferrer" className="share-item whatsapp">WhatsApp</a>
                    <a href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(window.location.href)}`} target="_blank" rel="noopener noreferrer" className="share-item x">X (Twitter)</a>
                    <a href={`https://www.instagram.com/`} target="_blank" rel="noopener noreferrer" className="share-item instagram">Instagram</a>
                    <button className="share-item copy" onClick={handleCopy} type="button">{copied ? 'Kopyalandı!' : 'Linki Kopyala'}</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {recentVideos.length > 0 && (
        <div>
          <h2 className="vtp-subtitle">Son Özetlenen Videolar</h2>
          <div className="card-list">
            {recentVideos.map((video, index) => (
              <div className="card" key={index}>
                <div className="card-player">
                  <ReactPlayer url={video.url} width="100%" height="160px" controls />
                </div>
                <div className="card-content">
                  <h3>{video.title}</h3>
                  <p>{video.author}</p>
                  <span className="card-date">{video.date}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoToPdf;