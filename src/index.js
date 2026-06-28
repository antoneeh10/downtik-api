export default {
  async fetch(request, env, ctx) {
    // 1. Handle CORS Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    // Menerima GET dan POST (POST disarankan untuk payload yang aman)
    if (request.method !== "GET" && request.method !== "POST") {
      return new Response(JSON.stringify({ code: -1, msg: "Metode tidak diizinkan. Gunakan GET atau POST." }), {
        status: 405,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    // 2. Ambil parameter query 'url' dan 'hd'
    const { searchParams } = new URL(request.url);
    let targetUrl = searchParams.get("url");
    const hdParam = searchParams.get("hd") || "1";

    if (!targetUrl) {
      return new Response(JSON.stringify({ 
        code: -1, 
        msg: "Parameter 'url' wajib diisi, bre! Contoh: ?url=https://vt.tiktok.com/xxx/" 
      }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    // 3. ULTRA CLEANER: Bersihkan URL
    try {
      while (targetUrl.includes('%')) {
        targetUrl = decodeURIComponent(targetUrl);
      }
    } catch (e) {}
    targetUrl = targetUrl.trim();

    // 4. Siapkan parameter untuk metode POST (TikWM lebih suka FormData untuk kestabilan)
    const formData = new FormData();
    formData.append("url", targetUrl);
    formData.append("hd", hdParam);

    // 5. PIPELINE PROXY KEROYOKAN
    // Kita pisah rute murni (bisa pakai POST) dan rute proxy (terpaksa pakai GET karena keterbatasan proxy publik)
    const baseTikwmGet = `https://www.tikwm.com/api/?url=${encodeURIComponent(targetUrl)}&hd=${hdParam}`;
    
    const pipelines = [
      { url: "https://www.tikwm.com/api/", method: "POST", body: formData }, // Jalur Utama (POST - Paling Kuat)
      { url: baseTikwmGet, method: "GET" },                                  // Jalur Cadangan 1 (Direct GET)
      { url: `https://api.allorigins.win/raw?url=${encodeURIComponent(baseTikwmGet)}`, method: "GET" },
      { url: `https://corsproxy.io/?url=${encodeURIComponent(baseTikwmGet)}`, method: "GET" },
      { url: `https://proxy.corsfix.com/?${encodeURIComponent(baseTikwmGet)}`, method: "GET" },
      { url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(baseTikwmGet)}`, method: "GET" }
    ];

    // 6. Mekanisme Failover dengan Safe JSON Parsing
    for (let i = 0; i < pipelines.length; i++) {
      const route = pipelines[i];
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000); // Naikkan ke 7 detik agar proxy punya waktu merespons

      try {
        const fetchOptions = {
          method: route.method,
          signal: controller.signal,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
          }
        };

        if (route.method === "POST") {
          fetchOptions.body = route.body;
        }

        const response = await fetch(route.url, fetchOptions);
        clearTimeout(timeoutId);

        if (!response.ok) continue;

        // SAFE PARSING: Ambil teks mentah dulu agar jika proxy mengembalikan HTML error, Worker tidak langsung crash
        const responseText = await response.text();
        let resJson;
        
        try {
          resJson = JSON.parse(responseText);
        } catch (jsonErr) {
          // Jika gagal parse JSON (berarti proxy mengembalikan teks/HTML rusak), lompat ke proxy berikutnya
          continue; 
        }

        // Validasi response sukses dari TikWM (bisa berupa object langsung, atau dibungkus oleh proxy tertentu)
        const finalData = resJson.contents ? JSON.parse(resJson.contents) : resJson;

        if (finalData && finalData.code === 0 && finalData.data) {
          finalData.worker_meta = {
            status: "success",
            pipeline_used: i === 0 ? "Direct POST (Main)" : i === 1 ? "Direct GET" : `Proxy Route ${i - 1}`,
            engine: "DownTik Workers v2.5 Premium"
          };

          return new Response(JSON.stringify(finalData, null, 2), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
              "Cache-Control": "public, max-age=30" // Sembari menghemat hit ke TikWM
            }
          });
        }
      } catch (err) {
        clearTimeout(timeoutId);
        // Otomatis skip ke index pipeline berikutnya jika timeout / network error
        continue;
      }
    }

    // 7. Jika semua cara di atas gagal total
    return new Response(JSON.stringify({
      code: -1,
      msg: "Semua rute pipa mampet, server TikWM sedang membatasi koneksi atau sedang maintenance. 😭",
      error_analysis: "Workers gagal menembus Direct Fetch (POST/GET) maupun seluruh backup multi-proxy pipeline."
    }), {
      status: 502,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
};
