// Test which novel sites respond to Vercel
export default async function handler(req, res) {
  const sites = [
    'https://truyenhh3d.com/',
    'https://truyenchu.net/',
    'https://sangtacviet.vip/',
    'https://metruyencv.com/',
    'https://dtruyen.com/',
    'https://bachngocsach.com.vn/',
    'https://wikisach.net/'
  ];
  
  const results = {};
  for (const s of sites) {
    try {
      const resp = await fetch(s, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'vi,en;q=0.9'
        },
        signal: AbortSignal.timeout(5000)
      });
      results[s] = { status: resp.status, ok: resp.ok };
    } catch(e) {
      results[s] = { error: e.message };
    }
  }

  res.status(200).json(results);
}
