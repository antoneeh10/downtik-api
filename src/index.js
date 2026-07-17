export default {
  async fetch(request, env, ctx) {
    // 1. Handle CORS Preflight (Biar bisa diakses dari domain mana pun)
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    // Hanya menerima request GET
    if (request.method !== "GET") {
      return new Response(JSON.stringify({ code: -1, msg: "Metode tidak diizinkan. Gunakan GET." }), {
        status: 405,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    // 2. Ambil parameter query 'url' dan 'hd' dari request user
    const { searchParams } = new URL(request.url);
    let targetUrl = searchParams.get("url");
    const hdParam = searchParams.get("hd") || "1"; // Default dibikin HD=1 sesuai bawaan web kamu

    if (!targetUrl) {
      return new Response(JSON.stringify({ 
        code: -1, 
        msg: "Parameter 'url' wajib diisi, bre! Contoh: ?url=https://vt.tiktok.com/xxx/" 
      }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    // 3. ULTRA CLEANER: Bersihkan URL dari encoding berlapis di sisi server
    try {
      while (targetUrl.includes('%')) {
        targetUrl = decodeURIComponent(targetUrl);
      }
    } catch (e) {
      // Abaikan jika sudah bersih
    }
    targetUrl = targetUrl.trim();

    // 4. Susun Base URL API Baru (Github Dev API)
    const newApiUrl = `https://tikwm.com/api?url=${encodeURIComponent(targetUrl)}&hd=${hdParam}`;

    // 5. PIPELINE PROXY KEROYOKAN (API di dalam API)
    // Rute pertama langsung tembak ke API baru, sisanya pakai proxy backup jika rute utama terblokir/down
    const pipelines = [
      newApiUrl, // Jalur utama: langsung tanpa proxy luar
      `https://api.allorigins.win/raw?url=${encodeURIComponent(newApiUrl)}`,
      `https://corsproxy.io/?url=${encodeURIComponent(newApiUrl)}`,
      `https://proxy.corsfix.com/?${encodeURIComponent(newApiUrl)}`,
      `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(newApiUrl)}`
    ];

    // 6. Mekanisme Failover: Mencoba satu per satu jalur jika ada yang tumbang
    for (let i = 0; i < pipelines.length; i++) {
      const currentRoute = pipelines[i];
      try {
        // Set timeout 6 detik per percobaan
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const response = await fetch(currentRoute, {
          method: "GET",
          signal: controller.signal,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
          }
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) continue;

        const resJson = await response.json();

        // Validasi struktur response (Pastikan API baru kamu mengembalikan format JSON yang sesuai)
        if (resJson.code === 0 && resJson.data) {
          // Tambahkan info jalur mana yang sukses tembus untuk tracking internal
          resJson.worker_meta = {
            status: "success",
            pipeline_used: i === 0 ? "Direct Fetch" : "Proxy Route " + i,
            engine: "DownTik Workers v2.0"
          };

          return new Response(JSON.stringify(resJson, null, 2), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*", // Mengizinkan web frontend kamu buat fetch langsung
              "Cache-Control": "public, max-age=60" // Cache opsional 1 menit
            }
          });
        }
      } catch (err) {
        // Jika error/timeout, otomatis lanjut melompati ke proxy berikutnya di looping
        continue;
      }
    }

    // 7. Gagal Total Response Handler
    return new Response(JSON.stringify({
      code: -1,
      msg: "Semua rute pipa mampet, server API sedang membatasi koneksi atau sedang maintenance. 😭",
      error_analysis: "Workers gagal menembus Direct Fetch maupun backup multi-proxy pipeline ke API baru."
    }), {
      status: 502,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
};
