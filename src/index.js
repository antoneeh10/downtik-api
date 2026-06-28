export default {
  async fetch(request, env, ctx) {
    // 1. Handle CORS Preflight (Biar bisa diakses dari frontend web kamu)
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

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

    // 3. ULTRA CLEANER: Bersihkan URL dari encoding ganda
    try {
      while (targetUrl.includes('%')) {
        targetUrl = decodeURIComponent(targetUrl);
      }
    } catch (e) {}
    targetUrl = targetUrl.trim();

    // Siapkan FormData untuk TikWM POST
    const tikwmFormData = new FormData();
    tikwmFormData.append("url", targetUrl);
    tikwmFormData.append("hd", hdParam);

    // 4. PIPELINE KEROYOKAN MULTI-API (TikWM + 2 Alternatif API)
    const pipelines = [
      {
        name: "TikWM (Jalur Utama - POST)",
        url: "https://www.tikwm.com/api/",
        method: "POST",
        body: tikwmFormData
      },
      {
        name: "TioDev API (Jalur Cadangan 1)",
        url: `https://api.tiodev.my.id/api/tiktok?url=${encodeURIComponent(targetUrl)}`,
        method: "GET",
        body: null
      },
      {
        name: "Cafirexos API (Jalur Cadangan 2)",
        url: `https://api.cafirexos.com/api/tiktok?url=${encodeURIComponent(targetUrl)}`,
        method: "GET",
        body: null
      }
    ];

    // 5. Mekanisme Failover & Standardisasi Response
    for (let i = 0; i < pipelines.length; i++) {
      const currentApi = pipelines[i];
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6500); // Timeout 6.5 detik per API

      try {
        const fetchOptions = {
          method: currentApi.method,
          signal: controller.signal,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
          }
        };

        if (currentApi.method === "POST") {
          fetchOptions.body = currentApi.body;
        }

        const response = await fetch(currentApi.url, fetchOptions);
        clearTimeout(timeoutId);

        if (!response.ok) continue;

        const responseText = await response.text();
        let resJson;
        
        try {
          resJson = JSON.parse(responseText);
        } catch (e) {
          continue; // Jika respon bukan JSON valid (misal kena blok HTML), lanjut API berikutnya
        }

        // ==========================================
        // KONDISI A: JIKA JALUR TIKWM YANG SUKSES
        // ==========================================
        if (i === 0 && resJson.code === 0 && resJson.data) {
          resJson.worker_meta = {
            status: "success",
            engine: "DownTik Workers v3.0 (Anti-Mampet)",
            provider: currentApi.name
          };

          return new Response(JSON.stringify(resJson, null, 2), {
            status: 200,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
          });
        }

        // ==========================================
        // KONDISI B: JIKA JALUR ALTERNATIF 1 (TioDev) YANG SUKSES
        // ==========================================
        if (i === 1 && resJson.status === true && resJson.result) {
          const mappedData = {
            code: 0,
            msg: "Success",
            data: {
              play: resJson.result.video || resJson.result.nowm || resJson.result.no_watermark,
              wmplay: resJson.result.watermark || resJson.result.wm,
              title: resJson.result.title || resJson.result.caption || "TikTok Video",
              cover: resJson.result.cover || "",
              origin_cover: resJson.result.origin_cover || "",
              duration: resJson.result.duration || 0,
              author: {
                nickname: resJson.result.author?.nickname || "TikTok User",
                avatar: resJson.result.author?.avatar || ""
              }
            },
            worker_meta: {
              status: "success",
              engine: "DownTik Workers v3.0 (Anti-Mampet)",
              provider: currentApi.name
            }
          };

          return new Response(JSON.stringify(mappedData, null, 2), {
            status: 200,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
          });
        }

        // ==========================================
        // KONDISI C: JIKA JALUR ALTERNATIF 2 (Cafirexos) YANG SUKSES
        // ==========================================
        if (i === 2 && resJson.result) {
          const mappedData = {
            code: 0,
            msg: "Success",
            data: {
              play: resJson.result.video || resJson.result.nowm,
              wmplay: resJson.result.watermark || "",
              title: resJson.result.title || "TikTok Video",
              cover: resJson.result.cover || "",
              author: {
                nickname: resJson.result.author?.name || "TikTok User",
                avatar: ""
              }
            },
            worker_meta: {
              status: "success",
              engine: "DownTik Workers v3.0 (Anti-Mampet)",
              provider: currentApi.name
            }
          };

          return new Response(JSON.stringify(mappedData, null, 2), {
            status: 200,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
          });
        }

      } catch (err) {
        clearTimeout(timeoutId);
        continue; // Jika timeout atau error jaringan, langsung skip ke API berikutnya
      }
    }

    // 6. JIKA SEMUA JALUR API GAGAL TOTAL
    return new Response(JSON.stringify({
      code: -1,
      msg: "Semua jalur pipa mampet, server TikTok downloader sedang limit atau maintenance di semua lini. 😭",
      error_analysis: "Workers gagal mendapatkan data valid dari TikWM, TioDev, maupun Cafirexos API."
    }), {
      status: 502,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
};
