// Fungsi pembantu untuk menghasilkan IP publik acak (Seolah-olah IP pengguna berbeda)
function getRandomIP() {
  const segments = [
    Math.floor(Math.random() * 140) + 20,  // Menghindari range IP lokal/private
    Math.floor(Math.random() * 255),
    Math.floor(Math.random() * 255),
    Math.floor(Math.random() * 254) + 1
  ];
  return segments.join('.');
}

// Daftar User-Agent acak agar tidak terdeteksi sebagai bot yang sama
const userAgents = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0"
];

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

    const { searchParams } = new URL(request.url);
    let targetUrl = searchParams.get("url");
    if (!targetUrl) {
      return new Response(JSON.stringify({ code: -1, msg: "Parameter 'url' wajib, bre!" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    try {
      while (targetUrl.includes('%')) { targetUrl = decodeURIComponent(targetUrl); }
    } catch (e) {}
    targetUrl = targetUrl.trim();

    // 2. GENERATE IP DAN USER AGENT ACAK
    const fakeIP = getRandomIP();
    const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];

    // 3. SUSUN HEADERS DENGAN IP SPOOFING TINGKAT TINGGI
    const spoofedHeaders = {
      "User-Agent": randomUA,
      "X-Forwarded-For": fakeIP,
      "X-Real-IP": fakeIP,
      "True-Client-IP": fakeIP,
      "CF-Connecting-IP": fakeIP,
      "Client-IP": fakeIP,
      "VIA": `1.1 Squid Proxy Fake-${Math.floor(Math.random() * 100)}`,
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9,id;q=0.8",
    };

    // 4. STRATEGI CLOUDFLARE EDGE LOCATIONS (Mencoba memaksa request pindah negara)
    // Cloudflare memiliki fitur `cf: { cfFetch: { ... } }` namun terbatas pada enterprise.
    // Trik gratisannya: Kita gunakan TikWM POST tetapi dialirkan lewat headers manipulasi.
    const tikwmFormData = new FormData();
    tikwmFormData.append("url", targetUrl);
    tikwmFormData.append("hd", "1");

    // Kita gunakan gabungan trik IP acak ini ke TikWM dan TioDev (sebagai cadangan)
    const pipelines = [
      {
        name: "TikWM Spoofed POST",
        url: "https://www.tikwm.com/api/",
        method: "POST",
        body: tikwmFormData
      },
      {
        name: "TioDev Spoofed GET",
        url: `https://api.tiodev.my.id/api/tiktok?url=${encodeURIComponent(targetUrl)}`,
        method: "GET",
        body: null
      }
    ];

    for (let i = 0; i < pipelines.length; i++) {
      const currentApi = pipelines[i];
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);

      try {
        const response = await fetch(currentApi.url, {
          method: currentApi.method,
          body: currentApi.body,
          headers: spoofedHeaders, // SUNTIKKAN HEADERS PALSU DI SINI
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        if (!response.ok) continue;

        const responseText = await response.text();
        let resJson = JSON.parse(responseText);

        // Map hasil TikWM asli
        if (i === 0 && resJson.code === 0 && resJson.data) {
          resJson.worker_meta = { status: "success", strategy: "IP Spoofing", fake_ip_used: fakeIP, provider: currentApi.name };
          return new Response(JSON.stringify(resJson, null, 2), {
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
          });
        }

        // Map hasil TioDev cadangan jika TikWM memblokir total
        if (i === 1 && resJson.status === true && resJson.result) {
          const mappedData = {
            code: 0,
            msg: "Success",
            data: {
              play: resJson.result.video || resJson.result.nowm,
              title: resJson.result.title || "TikTok Video",
              cover: resJson.result.cover || ""
            },
            worker_meta: { status: "success", strategy: "IP Spoofing Fallback", fake_ip_used: fakeIP, provider: currentApi.name }
          };
          return new Response(JSON.stringify(mappedData, null, 2), {
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
          });
        }

      } catch (err) {
        clearTimeout(timeoutId);
        continue;
      }
    }

    // 5. JIKA MASIH GAGAL (Artinya proteksi Cloudflare WAF di TikWM menolak mentah-mentah IP asli Cloudflare)
    return new Response(JSON.stringify({
      code: -1,
      msg: "TikTok mendeteksi request dari bot Cloudflare. IP Spoofing gagal menembus dinding pertahanan.",
      error_analysis: `Sudah mencoba menggunakan IP Samaran [${fakeIP}] tetapi koneksi utama Cloudflare diblokir oleh target.`
    }), {
      status: 502,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
};
