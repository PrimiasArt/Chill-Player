import { Communicate } from 'edge-tts-universal';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    let text = urlObj.searchParams.get('text');
    let voice = urlObj.searchParams.get('voice') || 'vi-VN-NamMinhNeural';
    let rate = urlObj.searchParams.get('rate') || '1.0';
    let pitch = urlObj.searchParams.get('pitch') || '1.0';

    if (req.method === 'POST' && req.body) {
      if (req.body.text) text = req.body.text;
      if (req.body.voice) voice = req.body.voice;
      if (req.body.rate) rate = req.body.rate;
      if (req.body.pitch) pitch = req.body.pitch;
    }

    if (!text || !text.trim()) {
      res.status(400).json({ error: 'Thiếu nội dung văn bản (text).' });
      return;
    }

    const cleanText = text.trim();

    // 1. Google Translate TTS Provider
    if (voice === 'google' || voice === 'google:vi') {
      const googleUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=vi&client=tw-ob&q=${encodeURIComponent(cleanText)}`;
      const gRes = await fetch(googleUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        signal: AbortSignal.timeout(10000)
      });

      if (!gRes.ok) {
        throw new Error(`Google TTS lỗi HTTP ${gRes.status}`);
      }

      const arrayBuffer = await gRes.arrayBuffer();
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
      res.status(200).send(Buffer.from(arrayBuffer));
      return;
    }

    // 2. Microsoft Edge Neural Provider (Nam Minh, Hoài My...)
    const cleanVoice = voice.replace(/^edge:/, '');

    const ratePercent = Math.round((parseFloat(rate) - 1.0) * 100);
    const rateStr = ratePercent >= 0 ? `+${ratePercent}%` : `${ratePercent}%`;

    const pitchHz = Math.round((parseFloat(pitch) - 1.0) * 50);
    const pitchStr = pitchHz >= 0 ? `+${pitchHz}Hz` : `${pitchHz}Hz`;

    const comm = new Communicate(cleanText, {
      voice: cleanVoice,
      rate: rateStr,
      pitch: pitchStr
    });

    const chunks = [];
    for await (const chunk of comm.stream()) {
      if (chunk.type === 'audio' && chunk.data) {
        chunks.push(chunk.data);
      }
    }

    if (chunks.length === 0) {
      throw new Error('Không nhận được dữ liệu âm thanh từ Edge TTS.');
    }

    const audioBuffer = Buffer.concat(chunks);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
    res.status(200).send(audioBuffer);
  } catch (err) {
    console.error('TTS API error:', err);
    res.status(500).json({ error: err.message || 'Lỗi tạo âm thanh TTS.' });
  }
}
