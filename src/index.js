export default {
  async fetch(request, env, ctx) {
    // 1. handle cors preflight super lengkap biar web frontend ga rewel
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
      "Access-Control-Max-Age": "86400",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // izinin GET atau POST (biar flexibel)
    if (request.method !== "GET" && request.method !== "POST") {
      return new Response(JSON.stringify({ code: -1, msg: "metode kagak diizinkan bre, pake GET atau POST!" }), {
        status: 405,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // 2. ambil parameter query
    const { searchParams } = new URL(request.url);
    let targetUrl = searchParams.get("url");
    const hdParam = searchParams.get("hd") || "1"; 

    if (!targetUrl) {
      return new Response(JSON.stringify({ 
        code: -1, 
        msg: "parameter 'url' wajib diisi woi! contoh: ?url=https://vt.tiktok.com/xxx/" 
      }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // 3. pembersihan url
    try {
      while (targetUrl.includes('%')) {
        targetUrl = decodeURIComponent(targetUrl);
      }
    } catch (e) {}
    targetUrl = targetUrl.trim();

    // 4. susun pipeline langsung ke API tikwm atau codespace lu
    // CATATAN: kalo mau pake url github dev, pastikan port di codespace lu udah diset ke PUBLIC!
    const newApiUrl = `https://cuddly-meme-g4rp7wxxwjjxfv4xp-3000.app.github.dev/api/download?url=${encodeURIComponent(targetUrl)}&hd=${hdParam}`;
    
    // alternatif backup: langsung tembak ke api tikwm asli lewat worker (worker kan ga kena cors)
    const backupTikwmUrl = `https://www.tikwm.com/api/`;

    const pipelines = [
      { url: newApiUrl, type: "direct" },
      { url: `https://corsproxy.io/?url=${encodeURIComponent(newApiUrl)}`, type: "proxy" },
      { url: backupTikwmUrl, type: "tikwm_direct" } // jalur dewa kalo codespace lu mati/private
    ];

    // 5. mekanisme failover yang lebih galak
    for (let i = 0; i < pipelines.length; i++) {
      const route = pipelines[i];
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 7000); // naikin dikit ke 7 detik

        let response;
        
        if (route.type === "tikwm_direct") {
          // kalo pake jalur tikwm langsung, kita kirim POST pake form data biar aman
          response = await fetch(route.url, {
            method: "POST",
            signal: controller.signal,
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            },
            body: new URLSearchParams({ 'url': targetUrl, 'hd': hdParam })
          });
        } else {
          // jalur biasa (GET)
          response = await fetch(route.url, {
            method: "GET",
            signal: controller.signal,
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              "Accept": "application/json"
            }
          });
        }
        
        clearTimeout(timeoutId);

        if (!response.ok) continue;

        // cek apakah responnya beneran json atau malah halaman login github html/text
        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
          continue; // skip kalo dikasih bumbu html buatan github login 😭
        }

        const resJson = await response.json();

        // normalisasi response biar formatnya tetep konsisten di frontend lu
        if (resJson.code === 0) {
          resJson.worker_meta = {
            status: "success",
            pipeline_used: `jalur ${route.type} (index ke-${i})`,
            engine: "downtik workers v2.5 premium super tembus 🗿"
          };

          return new Response(JSON.stringify(resJson, null, 2), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
              "Cache-Control": "no-store" // biar ga dapet data busuk/stale
            }
          });
        }
      } catch (err) {
        continue; // lanjut nyari jalur lain kalo timeout/error
      }
    }

    // 6. handler apes beneran gagal total
    return new Response(JSON.stringify({
      code: -1,
      msg: "semua rute pipa mampet cok! 😭",
      tips: "kalo lu pake github codespaces, pastiin status port 3000 udah lu ubah dari 'private' jadi 'public' di tab ports codespace lu!"
    }), {
      status: 502,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
};
