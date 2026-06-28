import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import FormData from 'form-data';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 1. Generator IP Acak Dunia (Menghindari limitasi IP tunggal server)
function getRandomIP() {
  const segments = [
    Math.floor(Math.random() * 140) + 20, 
    Math.floor(Math.random() * 255),
    Math.floor(Math.random() * 255),
    Math.floor(Math.random() * 254) + 1
  ];
  return segments.join('.');
}

const userAgents = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0"
];

// 2. Endpoint Utama Downloader
app.get('/api/download', async (req, res) => {
  let targetUrl = req.query.url;
  const hdParam = req.query.hd || "1";

  if (!targetUrl) {
    return res.status(400).json({ code: -1, msg: "Parameter 'url' wajib diisi, bre!" });
  }

  // Bersihkan URL
  try {
    while (targetUrl.includes('%')) { targetUrl = decodeURIComponent(targetUrl); }
  } catch (e) {}
  targetUrl = targetUrl.trim();

  const fakeIP = getRandomIP();
  const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];

  // Setup Spoofed Headers (Memaksa server target membaca IP acak dari kita)
  const spoofedHeaders = {
    "User-Agent": randomUA,
    "X-Forwarded-For": fakeIP,
    "X-Real-IP": fakeIP,
    "True-Client-IP": fakeIP,
    "Client-IP": fakeIP,
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9,id;q=0.8"
  };

  // Susun pipeline multi-API
  const tikwmFormData = new FormData();
  tikwmFormData.append("url", targetUrl);
  tikwmFormData.append("hd", hdParam);

  const pipelines = [
    {
      name: "TikWM (Jalur Utama - POST)",
      url: "https://www.tikwm.com/api/",
      method: "POST",
      body: tikwmFormData,
      headers: { ...spoofedHeaders, ...tikwmFormData.getHeaders() }
    },
    {
      name: "TioDev API (Jalur Cadangan 1)",
      url: `https://api.tiodev.my.id/api/tiktok?url=${encodeURIComponent(targetUrl)}`,
      method: "GET",
      body: null,
      headers: spoofedHeaders
    }
  ];

  // Jalankan mekanisme pertahanan perulangan (Failover)
  for (let i = 0; i < pipelines.length; i++) {
    const currentApi = pipelines[i];
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // Timeout 8 detik

    try {
      const response = await fetch(currentApi.url, {
        method: currentApi.method,
        body: currentApi.body,
        headers: currentApi.headers,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      if (!response.ok) continue;

      const responseText = await response.text();
      let resJson;
      try { resJson = JSON.parse(responseText); } catch (e) { continue; }

      // Map hasil jika TikWM sukses
      if (i === 0 && resJson.code === 0 && resJson.data) {
        resJson.worker_meta = { status: "success", server: "Codespaces Azure", provider: currentApi.name, fake_ip: fakeIP };
        return res.json(resJson);
      }

      // Map hasil jika TioDev sukses (Ubah format agar sama dengan TikWM)
      if (i === 1 && resJson.status === true && resJson.result) {
        const mappedData = {
          code: 0,
          msg: "Success",
          data: {
            play: resJson.result.video || resJson.result.nowm,
            title: resJson.result.title || "TikTok Video",
            cover: resJson.result.cover || ""
          },
          worker_meta: { status: "success", server: "Codespaces Azure", provider: currentApi.name, fake_ip: fakeIP }
        };
        return res.json(mappedData);
      }

    } catch (err) {
      clearTimeout(timeoutId);
      continue;
    }
  }

  // Jika semua jalur mampet
  return res.status(502).json({
    code: -1,
    msg: "Semua pipa mampet, server sedang membatasi koneksi.",
    error_analysis: "Azure IP + IP Spoofing gagal menembus restriksi TikWM/TioDev."
  });
});

app.listen(PORT, () => {
  console.log(`Server Node.js berjalan di port ${PORT}`);
});
