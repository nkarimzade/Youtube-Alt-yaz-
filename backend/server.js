const express = require('express');
const cors = require('cors');
const ytdl = require('ytdl-core');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const axios = require('axios');
const cheerio = require('cheerio');

// Hata yakalama
process.on('uncaughtException', (error) => {
  console.error('Yakalanmamış Hata:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('İşlenmemiş Reddetme:', error);
});

const app = express();
const port = process.env.PORT || 5000;

// OpenAI API yapılandırması
let openai;
try {
  openai = new OpenAI({
    apiKey: 'sk-your-api-key-here' // Buraya OpenAI API anahtarınızı ekleyin
  });
} catch (error) {
  console.error('OpenAI yapılandırma hatası:', error);
}

// Middleware
app.use(cors());
app.use(express.json());

// PDF'leri saklamak için klasör
const pdfDir = path.join(__dirname, 'pdfs');
try {
  if (!fs.existsSync(pdfDir)) {
    fs.mkdirSync(pdfDir);
  }
} catch (error) {
  console.error('PDF klasörü oluşturma hatası:', error);
}

// Video bilgilerini al
app.post('/api/video-info', async (req, res) => {
  try {
    console.log('Gelen URL:', req.body.url);
    const { url } = req.body;
    
    if (!url) {
      console.log('URL boş');
      return res.status(400).json({ error: 'URL gerekli' });
    }

    if (!ytdl.validateURL(url)) {
      console.log('Geçersiz YouTube URL');
      return res.status(400).json({ error: 'Geçerli bir YouTube URL\'si girin' });
    }

    try {
      // İlk yöntem: ytdl-core ile deneme
      console.log('ytdl-core ile video bilgileri alınıyor...');
      const info = await ytdl.getInfo(url);
      console.log('Video bilgileri ytdl-core ile alındı:', info.videoDetails.title);
      
      return res.json({
        title: info.videoDetails.title,
        author: info.videoDetails.author.name,
        lengthSeconds: info.videoDetails.lengthSeconds
      });
    } catch (ytdlError) {
      console.log('ytdl-core hatası:', ytdlError.message);
      console.log('Alternatif yöntem deneniyor...');
      
      try {
        // Alternatif yöntem: Web scraping
        console.log('Web scraping başlatılıyor...');
        const response = await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
        
        const $ = cheerio.load(response.data);
        
        const title = $('meta[property="og:title"]').attr('content') || 
                     $('title').text().replace(' - YouTube', '');
        
        const author = $('meta[property="og:video:tag"]').attr('content') || 
                      $('link[itemprop="name"]').attr('content') || 
                      'Bilinmeyen Yayıncı';
        
        const lengthSeconds = $('meta[itemprop="duration"]').attr('content') || '0';
        
        console.log('Video bilgileri web scraping ile alındı:', title);
        
        return res.json({
          title: title,
          author: author,
          lengthSeconds: lengthSeconds
        });
      } catch (scrapingError) {
        console.error('Web scraping hatası:', scrapingError);
        throw new Error('Video bilgileri alınamadı: ' + scrapingError.message);
      }
    }
  } catch (error) {
    console.error('Video bilgileri alınırken hata:', error);
    res.status(400).json({ error: 'Video bilgileri alınamadı: ' + error.message });
  }
});

// Altyazı çekme fonksiyonu
async function getSubtitles(url) {
  try {
    const info = await ytdl.getInfo(url);
    const tracks = info.player_response.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!tracks || tracks.length === 0) return null;
    // Türkçe veya İngilizce altyazı öncelikli
    let track = tracks.find(t => t.languageCode === 'tr') || tracks.find(t => t.languageCode === 'en') || tracks[0];
    if (!track) return null;
    const res = await axios.get(track.baseUrl);
    // YouTube altyazı XML formatında döner
    const xml = res.data;
    const regex = /<text start="([\d.]+)" dur="([\d.]+)?"?>([\s\S]*?)<\/text>/g;
    let match;
    const subtitles = [];
    while ((match = regex.exec(xml)) !== null) {
      const start = parseFloat(match[1]);
      const dur = parseFloat(match[2] || 0);
      let text = match[3].replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/<.*?>/g, '');
      subtitles.push({
        start,
        dur,
        text
      });
    }
    return subtitles;
  } catch (e) {
    return null;
  }
}

// Video özetini oluştur ve PDF'e dönüştür
app.post('/api/create-pdf', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'URL gerekli' });
    }

    // Video bilgilerini al
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    const $ = cheerio.load(response.data);
    const videoTitle = $('meta[property="og:title"]').attr('content') || $('title').text().replace(' - YouTube', '');
    const description = $('meta[property="og:description"]').attr('content') || 'Video açıklaması bulunamadı';
    const author = $('link[itemprop="name"]').attr('content') || 'Bilinmeyen Yayıncı';

    // Altyazıları çek
    const subtitles = await getSubtitles(url);

    // Video içeriğini oluştur
    const content = `Video Başlığı: ${videoTitle}\nYayıncı: ${author}\n\nVideo Açıklaması:\n${description}\n\nNot: Bu özet, video açıklaması ve meta verileri kullanılarak oluşturulmuştur.`;

    // OpenAI ile özet oluştur
    const summary = await generateSummary(content);

    // PDF oluştur
    const pdfPath = await createPDF(videoTitle, summary, subtitles);

    // PDF'i gönder
    res.download(pdfPath, `${videoTitle}.pdf`, (err) => {
      if (err) {
        console.error('PDF gönderme hatası:', err);
      }
      // PDF'i sil
      try {
        fs.unlinkSync(pdfPath);
      } catch (unlinkError) {
        console.error('PDF silme hatası:', unlinkError);
      }
    });
  } catch (error) {
    console.error('PDF oluşturma hatası:', error);
    res.status(500).json({ error: 'PDF oluşturulamadı: ' + error.message });
  }
});

// OpenAI ile özet oluştur
async function generateSummary(text) {
  try {
    if (!openai) {
      throw new Error('OpenAI yapılandırması eksik');
    }

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "Sen bir video özetleyicisin. Verilen video bilgilerini kullanarak detaylı bir özet oluştur. Özeti şu başlıklar altında düzenle:\n1. Video Hakkında Genel Bilgi\n2. Ana Konular\n3. Önemli Noktalar\n4. Sonuç"
        },
        {
          role: "user",
          content: text
        }
      ],
      max_tokens: 1000
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error('Özet oluşturma hatası:', error);
    // OpenAI hatası durumunda orijinal metni döndür
    return text;
  }
}

// PDF oluştur
async function createPDF(title, summary, subtitles) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const pdfPath = path.join(pdfDir, `${Date.now()}.pdf`);
      const stream = fs.createWriteStream(pdfPath);
      doc.pipe(stream);
      let pageNum = 1;
      // HEADER
      doc.rect(0, 0, doc.page.width, 60).fill('#121212');
      doc.fillColor('#00BFA6').fontSize(22).font('Helvetica-Bold').text('YouTube Video Özeti', 40, 22, { align: 'left' });
      doc.moveDown(2);
      // Başlık
      doc.fillColor('#fff').fontSize(18).font('Helvetica-Bold').text(title, { align: 'center' }).moveDown(0.5);
      // Tarih
      doc.fontSize(10).font('Helvetica').fillColor('#bbb').text(`Oluşturulma Tarihi: ${new Date().toLocaleDateString('tr-TR')}`, { align: 'right' }).moveDown(1);
      // Özet kutusu
      doc.roundedRect(40, doc.y, doc.page.width-80, 80).fillAndStroke('#f3f4f6', '#00BFA6');
      doc.fillColor('#121212').fontSize(13).font('Helvetica-Bold').text('Video Özeti', 50, doc.y-70, { align: 'left', underline: true });
      doc.fontSize(12).font('Helvetica').fillColor('#222').text(summary, 50, doc.y-50, { width: doc.page.width-100, align: 'justify', lineGap: 4 });
      doc.moveDown(5);
      // Açıklama kutusu
      doc.roundedRect(40, doc.y, doc.page.width-80, 60).fillAndStroke('#e5e7eb', '#00BFA6');
      doc.fillColor('#121212').fontSize(12).font('Helvetica-Bold').text('Video Açıklaması', 50, doc.y-50, { align: 'left' });
      doc.fontSize(11).font('Helvetica').fillColor('#333').text(summary, 50, doc.y-30, { width: doc.page.width-100, align: 'justify', lineGap: 3 });
      doc.moveDown(4);
      // Altyazılar
      if (subtitles && subtitles.length > 0) {
        doc.addPage();
        pageNum++;
        doc.fillColor('#00BFA6').fontSize(15).font('Helvetica-Bold').text('Video Altyazıları', { align: 'center', underline: true });
        doc.moveDown(1);
        subtitles.slice(0, 100).forEach(sub => {
          const min = Math.floor(sub.start / 60).toString().padStart(2, '0');
          const sec = Math.floor(sub.start % 60).toString().padStart(2, '0');
          // Kart/kutu altyazı
          doc.roundedRect(doc.x, doc.y, doc.page.width-80, 28).fillAndStroke('#1e1e1e', '#00BFA6');
          doc.fillColor('#00BFA6').fontSize(10).text(`[${min}:${sec}] `, doc.x+10, doc.y-20, { continued: true });
          doc.fontSize(11).fillColor('#fff').text(sub.text, doc.x+60, doc.y-20);
          doc.moveDown(1.2);
        });
        doc.moveDown(1);
        doc.fontSize(9).fillColor('#888').text('Not: Sadece ilk 100 altyazı gösterilmiştir.', { align: 'right' });
      }
      // Footer ve sayfa numarası
      const addFooter = () => {
        doc.fontSize(9).fillColor('#888').text('StreamMind | YouTube Video Özetleyici', 40, doc.page.height-40, { align: 'left' });
        doc.fontSize(9).fillColor('#888').text(`Sayfa ${pageNum}`, 0, doc.page.height-40, { align: 'right' });
      };
      addFooter();
      doc.on('pageAdded', () => {
        pageNum++;
        addFooter();
      });
      doc.end();
      stream.on('finish', () => resolve(pdfPath));
      stream.on('error', (error) => reject(error));
    } catch (error) {
      reject(error);
    }
  });
}

// Sunucuyu başlat
try {
  app.listen(port, () => {
    console.log(`Server ${port} portunda çalışıyor`);
  });
} catch (error) {
  console.error('Sunucu başlatma hatası:', error);
} 