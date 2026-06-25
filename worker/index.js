export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Max-Age': '86400',
    };

    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      if (path === '/admin' || path === '/admin/') {
        return await serveAdminPage(env, corsHeaders);
      }

      if (path === '/api/submit' && method === 'POST') {
        return await handleSubmit(request, env, corsHeaders);
      }
      if (path === '/api/upload' && method === 'POST') {
        return await handleUpload(request, env, corsHeaders);
      }
      if (path === '/api/list' && method === 'GET') {
        return await handleList(request, url, env, corsHeaders);
      }
      if (path === '/api/detail' && method === 'GET') {
        return await handleDetail(request, url, env, corsHeaders);
      }
      if (path === '/api/status' && method === 'POST') {
        return await handleStatus(request, env, corsHeaders);
      }
      if (path === '/api/stats' && method === 'GET') {
        return await handleStats(request, url, env, corsHeaders);
      }
      if (path === '/api/geocode' && method === 'GET') {
        return await handleGeocode(request, url, env, corsHeaders);
      }
      if (path === '/api/pin' && method === 'POST') {
        return await handlePin(request, env, corsHeaders);
      }
      if (path === '/api/delete' && method === 'DELETE') {
        return await handleDelete(request, env, corsHeaders);
      }
      if (path === '/api/delete-by-user' && method === 'POST') {
        return await handleDeleteByUser(request, env, corsHeaders);
      }
      return new Response(JSON.stringify({ error: 'Not Found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    } catch (err) {
      console.error('Worker error:', err);
      return new Response(JSON.stringify({ error: 'Internal Server Error', message: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
  },
};

async function handleSubmit(request, env, corsHeaders) {
  const body = await request.json();

  if (!body.reporterName || !body.reporterPhone || !body.selectedCity || !body.cinemaName) {
    return new Response(JSON.stringify({ error: '请填写完整信息' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const id = 'SUB-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
  const timestamp = new Date().toISOString();

  const submission = {
    id,
    timestamp,
    reporterName: body.reporterName,
    reporterTitle: body.reporterTitle || '',
    reporterPhone: body.reporterPhone,
    selectedCity: body.selectedCity,
    selectedCounty: body.selectedCounty || '',
    cinemaName: body.cinemaName,
    hazards: body.hazards || {},
    othersText: body.othersText || '',
    photos: body.photos || [],
    othersPhotos: body.othersPhotos || [],
    status: 'pending',
    note: '',
    rewardAmount: body.rewardAmount || 0,
  };

  await env.SUBMISSIONS_KV.put(`submission:${id}`, JSON.stringify(submission));

  const indexStr = await env.SUBMISSIONS_KV.get('submissions:index');
  const index = indexStr ? JSON.parse(indexStr) : [];
  index.unshift(id);
  if (index.length > 1000) index.length = 1000;
  await env.SUBMISSIONS_KV.put('submissions:index', JSON.stringify(index));

  return new Response(JSON.stringify({ success: true, id }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

async function handleUpload(request, env, corsHeaders) {
  const body = await request.json();
  const { fileName } = body;

  if (!fileName) {
    return new Response(JSON.stringify({ error: '缺少文件名' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const ossEndpoint = env.OSS_ENDPOINT;
  const accessKey = env.OSS_ACCESS_KEY;
  const secretKey = env.OSS_SECRET_KEY;

  if (!ossEndpoint || !accessKey || !secretKey) {
    return new Response(JSON.stringify({
      directSubmit: true,
      message: '未配置OSS，图片将以base64形式随提交数据一起发送',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const objectKey = `uploads/${Date.now()}_${fileName}`;
  const expiration = new Date(Date.now() + 3600000).toISOString();

  const policy = {
    expiration,
    conditions: [
      ['eq', '$key', objectKey],
      ['eq', '$success_action_status', '200'],
    ],
  };

  const policyBase64 = btoa(JSON.stringify(policy));
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secretKey),
    { name: 'HMAC', hash: 'SHA-1' },
    false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(policyBase64));
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));

  return new Response(JSON.stringify({
    uploadUrl: `${ossEndpoint}/${objectKey}`,
    publicUrl: `${ossEndpoint}/${objectKey}`,
    formData: {
      key: objectKey,
      policy: policyBase64,
      OSSAccessKeyId: accessKey,
      signature: signatureBase64,
      success_action_status: '200',
    },
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

async function handleList(request, url, env, corsHeaders) {
  const password = url.searchParams.get('password');
  if (!password || password !== env.ADMINPASSWORD) {
    return new Response(JSON.stringify({ error: '密码错误' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const sort = url.searchParams.get('sort') || 'newest';
  const city = url.searchParams.get('city') || '';
  const status = url.searchParams.get('status') || '';
  const page = parseInt(url.searchParams.get('page') || '1');
  const pageSize = parseInt(url.searchParams.get('pageSize') || '20');
  const keyword = url.searchParams.get('keyword') || '';

  const indexStr = await env.SUBMISSIONS_KV.get('submissions:index');
  if (!indexStr) {
    return new Response(JSON.stringify({ list: [], total: 0, page: 1 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  let ids = JSON.parse(indexStr);

  const pinnedStr = await env.SUBMISSIONS_KV.get('pinned:index');
  const pinnedIds = pinnedStr ? JSON.parse(pinnedStr) : [];

  const pinned = ids.filter(id => pinnedIds.includes(id));
  const unpinned = ids.filter(id => !pinnedIds.includes(id));

  let sortedUnpinned = [...unpinned];
  if (sort === 'oldest') sortedUnpinned = sortedUnpinned.reverse();

  const sortedIds = [...pinned, ...sortedUnpinned];

  const allSubmissions = [];
  for (const id of sortedIds) {
    const dataStr = await env.SUBMISSIONS_KV.get(`submission:${id}`);
    if (dataStr) allSubmissions.push(JSON.parse(dataStr));
  }

  let filtered = allSubmissions;
  if (city) filtered = filtered.filter(s => s.selectedCity === city);
  if (status) filtered = filtered.filter(s => s.status === status);
  if (keyword) {
    const kw = keyword.toLowerCase();
    filtered = filtered.filter(s =>
      s.cinemaName.toLowerCase().includes(kw) ||
      s.reporterName.toLowerCase().includes(kw) ||
      s.reporterPhone.includes(kw) ||
      s.id.toLowerCase().includes(kw)
    );
  }

  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const list = filtered.slice(start, start + pageSize).map(s => ({
    id: s.id,
    timestamp: s.timestamp,
    reporterName: s.reporterName,
    reporterTitle: s.reporterTitle,
    reporterPhone: s.reporterPhone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'),
    selectedCity: s.selectedCity,
    selectedCounty: s.selectedCounty,
    cinemaName: s.cinemaName,
    status: s.status,
    hazardCount: Object.values(s.hazards || {}).filter(h => h.checked).length + (s.othersText ? 1 : 0),
    photoCount: (s.photos || []).length + (s.othersPhotos || []).length,
    rewardAmount: s.rewardAmount || 0,
    isPinned: pinnedIds.includes(s.id),
  }));

  return new Response(JSON.stringify({ list, total, page, pageSize }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

async function handleDetail(request, url, env, corsHeaders) {
  const password = url.searchParams.get('password');
  if (!password || password !== env.ADMINPASSWORD) {
    return new Response(JSON.stringify({ error: '密码错误' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const id = url.searchParams.get('id');
  if (!id) {
    return new Response(JSON.stringify({ error: '缺少ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const dataStr = await env.SUBMISSIONS_KV.get(`submission:${id}`);
  if (!dataStr) {
    return new Response(JSON.stringify({ error: '未找到' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  return new Response(dataStr, {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

async function handleStatus(request, env, corsHeaders) {
  const body = await request.json();

  const password = body.password;
  if (!password || password !== env.ADMINPASSWORD) {
    return new Response(JSON.stringify({ error: '密码错误' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const { id, status, note, rewardAmount } = body;
  if (!id || !status) {
    return new Response(JSON.stringify({ error: '缺少ID或状态' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const dataStr = await env.SUBMISSIONS_KV.get(`submission:${id}`);
  if (!dataStr) {
    return new Response(JSON.stringify({ error: '未找到' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const data = JSON.parse(dataStr);
  data.status = status;
  if (note !== undefined) data.note = note;
  if (rewardAmount !== undefined) data.rewardAmount = rewardAmount;

  await env.SUBMISSIONS_KV.put(`submission:${id}`, JSON.stringify(data));

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

async function handleStats(request, url, env, corsHeaders) {
  const password = url.searchParams.get('password');
  if (!password || password !== env.ADMINPASSWORD) {
    return new Response(JSON.stringify({ error: '密码错误' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const indexStr = await env.SUBMISSIONS_KV.get('submissions:index');
  if (!indexStr) {
    return new Response(JSON.stringify({ total: 0, byCity: {}, byStatus: {} }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const ids = JSON.parse(indexStr);
  const byCity = {};
  const byStatus = { pending: 0, reviewing: 0, resolved: 0, invalid: 0 };
  let total = 0;

  for (const id of ids) {
    const dataStr = await env.SUBMISSIONS_KV.get(`submission:${id}`);
    if (dataStr) {
      const data = JSON.parse(dataStr);
      total++;
      byCity[data.selectedCity] = (byCity[data.selectedCity] || 0) + 1;
      byStatus[data.status] = (byStatus[data.status] || 0) + 1;
    }
  }

  return new Response(JSON.stringify({ total, byCity, byStatus }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

function md5(str) {
  const rotateLeft = (x, n) => (x << n) | (x >>> (32 - n));
  const toHex = (num) => {
    let hex = '';
    for (let i = 0; i < 4; i++) {
      hex += ('0' + ((num >>> (i * 8)) & 0xFF).toString(16)).slice(-2);
    }
    return hex;
  };

  const utf8Encode = (s) => {
    return unescape(encodeURIComponent(s));
  };

  const s = utf8Encode(str);
  const n = s.length;
  const state = [0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476];
  const block = [];
  let i = 0;

  for (i = 0; i < n; i++) {
    block[i >> 2] = (block[i >> 2] || 0) + (s.charCodeAt(i) << ((i % 4) * 8));
  }

  block[i >> 2] = (block[i >> 2] || 0) + (0x80 << ((i % 4) * 8));
  block[(((i + 8) >> 6) << 4) + 14] = n * 8;

  const S = [
    [7, 12, 17, 22],
    [5, 9, 14, 20],
    [4, 11, 16, 23],
    [6, 10, 15, 21]
  ];
  const T = new Array(64);
  for (i = 0; i < 64; i++) {
    T[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000);
  }

  for (let offset = 0; offset < block.length; offset += 16) {
    const X = block.slice(offset, offset + 16);
    let [A, B, C, D] = state;

    for (let j = 0; j < 64; j++) {
      let F, g;
      if (j < 16) {
        F = (B & C) | (~B & D);
        g = j;
      } else if (j < 32) {
        F = (D & B) | (~D & C);
        g = (5 * j + 1) % 16;
      } else if (j < 48) {
        F = B ^ C ^ D;
        g = (3 * j + 5) % 16;
      } else {
        F = C ^ (B | ~D);
        g = (7 * j) % 16;
      }
      const temp = D;
      D = C;
      C = B;
      B = B + rotateLeft((A + F + T[j] + (X[g] || 0)) & 0xFFFFFFFF, S[Math.floor(j / 16)][j % 4]);
      A = temp;
    }

    state[0] = (state[0] + A) & 0xFFFFFFFF;
    state[1] = (state[1] + B) & 0xFFFFFFFF;
    state[2] = (state[2] + C) & 0xFFFFFFFF;
    state[3] = (state[3] + D) & 0xFFFFFFFF;
  }

  return state.map(toHex).join('');
}

function generateAmapJscode(secret, params) {
  const sorted = params.split('&').sort().join('&');
  return md5(secret + sorted);
}

async function handleGeocode(request, url, env, corsHeaders) {
  const lat = url.searchParams.get('lat');
  const lng = url.searchParams.get('lng');
  
  if (!lat || !lng) {
    return new Response(JSON.stringify({ error: '缺少经纬度参数' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const amapKey = env.AMAP_KEY || '12dad5aebb86693478fdd9dcc8a9c9e8';
  const amapSecret = env.AMAP_SECRET || 'a58543d0559167a49bbd9ef061f2599d';

  try {
    const params = `location=${lng},${lat}&key=${amapKey}&output=json&radius=1000&extensions=base`;
    const jscode = generateAmapJscode(amapSecret, params);
    
    const amapUrl = `https://restapi.amap.com/v3/geocode/regeo?${params}&jscode=${jscode}`;
    const response = await fetch(amapUrl);
    const data = await response.json();

    if (data.status !== '1') {
      return new Response(JSON.stringify({
        error: '高德API返回错误',
        info: data.info || '未知错误',
        raw: data
      }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const regeo = data.regeocode || {};
    const addressComponent = regeo.addressComponent || {};
    
    const province = addressComponent.province || '';
    
    let city = addressComponent.city || '';
    if (!city || city === '[]' || city === '') {
      city = addressComponent.province || '';
    }
    if (!city || city === '[]' || city === '') {
      const formatted = regeo.formatted_address || '';
      const streetInfo = addressComponent.streetNumber || {};
      if (province && ['北京市','天津市','上海市','重庆市'].includes(province)) {
        city = province;
      }
    }
    
    let district = addressComponent.district || '';
    if (!district) {
      district = addressComponent.township || '';
    }
    
    const township = addressComponent.township || '';

    const result = {
      province,
      city,
      district,
      township,
      formattedAddress: regeo.formatted_address || '',
      rawAddressComponent: addressComponent,
    };

    console.log('高德逆地理编码结果:', JSON.stringify(result));

    return new Response(JSON.stringify({ success: true, data: result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err) {
    console.error('高德API请求失败:', err);
    return new Response(JSON.stringify({ error: '高德API请求失败', message: err.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}

async function handlePin(request, env, corsHeaders) {
  const body = await request.json();
  const password = body.password;
  if (!password || password !== env.ADMINPASSWORD) {
    return new Response(JSON.stringify({ error: '密码错误' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const { id } = body;
  if (!id) {
    return new Response(JSON.stringify({ error: '缺少ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const pinnedStr = await env.SUBMISSIONS_KV.get('pinned:index');
  let pinnedIds = pinnedStr ? JSON.parse(pinnedStr) : [];

  if (pinnedIds.includes(id)) {
    pinnedIds = pinnedIds.filter(pid => pid !== id);
  } else {
    if (pinnedIds.length >= 3) {
      return new Response(JSON.stringify({ error: '最多只能置顶3个报告单' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
    pinnedIds.push(id);
  }

  await env.SUBMISSIONS_KV.put('pinned:index', JSON.stringify(pinnedIds));

  return new Response(JSON.stringify({ success: true, pinned: pinnedIds.includes(id) }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

async function handleDelete(request, env, corsHeaders) {
  const body = await request.json();
  const password = body.password;
  if (!password || password !== env.ADMINPASSWORD) {
    return new Response(JSON.stringify({ error: '密码错误' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const { id } = body;
  if (!id) {
    return new Response(JSON.stringify({ error: '缺少ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  await env.SUBMISSIONS_KV.delete(`submission:${id}`);

  const indexStr = await env.SUBMISSIONS_KV.get('submissions:index');
  if (indexStr) {
    let ids = JSON.parse(indexStr);
    ids = ids.filter(i => i !== id);
    await env.SUBMISSIONS_KV.put('submissions:index', JSON.stringify(ids));
  }

  const pinnedStr = await env.SUBMISSIONS_KV.get('pinned:index');
  if (pinnedStr) {
    let pinnedIds = JSON.parse(pinnedStr);
    pinnedIds = pinnedIds.filter(pid => pid !== id);
    await env.SUBMISSIONS_KV.put('pinned:index', JSON.stringify(pinnedIds));
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

async function handleDeleteByUser(request, env, corsHeaders) {
  const body = await request.json();
  const { id } = body;
  if (!id) {
    return new Response(JSON.stringify({ error: '缺少ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  await env.SUBMISSIONS_KV.delete(`submission:${id}`);

  const indexStr = await env.SUBMISSIONS_KV.get('submissions:index');
  if (indexStr) {
    let ids = JSON.parse(indexStr);
    ids = ids.filter(i => i !== id);
    await env.SUBMISSIONS_KV.put('submissions:index', JSON.stringify(ids));
  }

  const pinnedStr = await env.SUBMISSIONS_KV.get('pinned:index');
  if (pinnedStr) {
    let pinnedIds = JSON.parse(pinnedStr);
    pinnedIds = pinnedIds.filter(pid => pid !== id);
    await env.SUBMISSIONS_KV.put('pinned:index', JSON.stringify(pinnedIds));
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

async function serveAdminPage(env, corsHeaders) {
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>影院隐患举报 - 管理后台</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;color:#333}
.login-screen{display:flex;align-items:center;justify-content:center;min-height:100vh;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%)}
.login-box{background:white;padding:40px;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,0.3);width:360px;max-width:90vw}
.login-box h1{font-size:22px;margin-bottom:8px;text-align:center}
.login-box p{color:#666;font-size:14px;text-align:center;margin-bottom:24px}
.login-box input{width:100%;padding:12px 16px;border:2px solid #e0e0e0;border-radius:10px;font-size:16px;outline:none;transition:border-color .2s}
.login-box input:focus{border-color:#667eea}
.login-box button{width:100%;padding:12px;background:#667eea;color:white;border:none;border-radius:10px;font-size:16px;cursor:pointer;margin-top:16px;transition:background .2s}
.login-box button:hover{background:#5a6fd6}
.login-error{color:#e74c3c;font-size:13px;text-align:center;margin-top:12px;display:none}
.dashboard{display:none;max-width:1400px;margin:0 auto;padding:20px}
.header{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:12px}
.header h1{font-size:24px}
.header-right{display:flex;align-items:center;gap:16px}
.header-right button{padding:8px 16px;background:#e74c3c;color:white;border:none;border-radius:8px;cursor:pointer;font-size:13px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:24px}
.stat-card{background:white;padding:16px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);text-align:center}
.stat-card .num{font-size:28px;font-weight:bold;color:#667eea}
.stat-card .label{font-size:13px;color:#666;margin-top:4px}
.filters{display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap;align-items:center}
.filters select,.filters input{padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;outline:none}
.filters input{flex:1;min-width:200px}
.filters button{padding:8px 20px;background:#667eea;color:white;border:none;border-radius:8px;cursor:pointer;font-size:14px}
.table-wrap{background:white;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);overflow-x:auto}
table{width:100%;border-collapse:collapse}
th{background:#f8f9fa;padding:12px 16px;text-align:left;font-size:13px;color:#666;font-weight:600;white-space:nowrap}
td{padding:12px 16px;font-size:14px;border-top:1px solid #f0f0f0}
tr:hover{background:#f8f9fa}
.status-badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:500}
.status-pending{background:#fff3cd;color:#856404}
.status-reviewing{background:#cce5ff;color:#004085}
.status-resolved{background:#d4edda;color:#155724}
.status-invalid{background:#f8d7da;color:#721c24}
.clickable{cursor:pointer;color:#667eea}
.clickable:hover{text-decoration:underline}
.pagination{display:flex;justify-content:center;align-items:center;gap:12px;padding:20px}
.pagination button{padding:6px 14px;border:1px solid #ddd;border-radius:6px;background:white;cursor:pointer}
.pagination button:disabled{opacity:.5;cursor:not-allowed}
.pagination span{font-size:14px;color:#666}
.modal-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:1000;align-items:center;justify-content:center;padding:20px}
.modal{background:white;border-radius:16px;max-width:700px;width:100%;max-height:90vh;overflow-y:auto;padding:32px;position:relative}
.modal h2{font-size:20px;margin-bottom:20px}
.modal .close-btn{position:absolute;top:16px;right:16px;background:none;border:none;font-size:24px;cursor:pointer;color:#999}
.modal .field{margin-bottom:12px}
.modal .field-label{font-size:12px;color:#999;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}
.modal .field-value{font-size:15px}
.modal .photos-grid{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
.modal .photos-grid img{width:100px;height:100px;object-fit:cover;border-radius:8px;border:1px solid #eee;cursor:pointer}
.modal .hazard-item{padding:8px 12px;background:#f8f9fa;border-radius:8px;margin-bottom:6px;font-size:14px}
.modal .status-select{padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;margin-right:8px}
.modal .save-btn{padding:8px 20px;background:#667eea;color:white;border:none;border-radius:8px;cursor:pointer;font-size:14px}
.modal textarea{width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;resize:vertical;min-height:60px;margin-top:8px}
.loading{text-align:center;padding:40px;color:#999}
.empty{text-align:center;padding:40px;color:#999}
@media(max-width:768px){
  .dashboard{padding:12px}
  .filters{flex-direction:column}
  .filters input{min-width:auto;width:100%}
  .modal{padding:20px}
}
</style>
</head>
<body>

<div class="login-screen" id="loginScreen">
  <div class="login-box">
    <h1>🔒 管理后台</h1>
    <p>影院隐患举报系统 · 数据管理</p>
    <div style="display:flex;gap:0;">
      <input type="password" id="passwordInput" placeholder="请输入管理密码" onkeydown="if(event.key==='Enter')login()" style="flex:1;border-top-right-radius:0;border-bottom-right-radius:0;" autocomplete="off">
      <button id="togglePasswordBtn" type="button" onclick="togglePassword()" style="width:48px;flex-shrink:0;background:white;border:2px solid #e0e0e0;border-left:none;border-radius:0 10px 10px 0;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#999;padding:0;margin:0;" title="显示密码">
        <svg id="eyeOpenIcon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
        <svg id="eyeClosedIcon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:none;">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
          <line x1="1" y1="1" x2="23" y2="23"/>
          <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/>
        </svg>
      </button>
    </div>
    <button id="loginBtn" onclick="login()">登录</button>
    <div class="login-error" id="loginError">密码错误，请重试</div>
  </div>
</div>

<div class="dashboard" id="dashboard">
  <div class="header">
    <h1>📋 举报数据管理</h1>
    <div class="header-right">
      <span id="totalCount" style="font-size:14px;color:#666;">共 0 条</span>
      <button onclick="logout()">退出登录</button>
    </div>
  </div>

  <div class="stats" id="statsContainer"></div>

  <div class="filters">
    <select id="filterCity" onchange="loadList()">
      <option value="">全部城市</option>
    </select>
    <select id="filterStatus" onchange="loadList()">
      <option value="">全部状态</option>
      <option value="pending">待处理</option>
      <option value="reviewing">处理中</option>
      <option value="resolved">已解决</option>
      <option value="invalid">无效</option>
    </select>
    <select id="filterSort" onchange="loadList()">
      <option value="newest">最新优先</option>
      <option value="oldest">最早优先</option>
    </select>
    <input type="text" id="filterKeyword" placeholder="搜索影院/姓名/电话/ID..." onkeydown="if(event.key==='Enter')loadList()">
    <button onclick="loadList()">🔍 搜索</button>
  </div>

  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th style="width:30px;">置顶</th>
          <th>ID</th>
          <th>提交时间</th>
          <th>影院名称</th>
          <th>地区</th>
          <th>举报人</th>
          <th>状态</th>
          <th>隐患数</th>
          <th>照片数</th>
          <th>操作</th>
          <th style="width:60px;">删除</th>
        </tr>
      </thead>
      <tbody id="tableBody">
        <tr><td colspan="11" class="loading">加载中...</td></tr>
      </tbody>
    </table>
  </div>

  <div class="pagination" id="pagination"></div>
</div>

<div class="modal-overlay" id="detailModal">
  <div class="modal">
    <button class="close-btn" onclick="closeDetail()">&times;</button>
    <h2 id="detailTitle">举报详情</h2>
    <div id="detailContent"></div>
  </div>
</div>

<div class="modal-overlay" id="imagePreview" style="background:rgba(0,0,0,0.85);cursor:pointer;" onclick="this.style.display='none'">
  <img id="previewImage" style="max-width:90vw;max-height:90vh;border-radius:8px;">
</div>

<script>
const WORKER_URL = 'https://api.quruifps.xyz';
const API_BASE = window.location.hostname === 'api.quruifps.xyz' ? '' : WORKER_URL;
const CITIES = ['长沙市','株洲市','湘潭市','衡阳市','邵阳市','岳阳市','常德市','张家界市','益阳市','郴州市','永州市','怀化市','娄底市','湘西土家族苗族自治州'];
const STATUS_LABELS = { pending:'待处理', reviewing:'处理中', resolved:'已解决', invalid:'无效' };
const STATUS_COLORS = { pending:'#856404', reviewing:'#004085', resolved:'#155724', invalid:'#721c24' };

let PASSWORD = '';
let currentPage = 1;

function api(path) {
  return API_BASE + path;
}

function togglePassword() {
  const input = document.getElementById('passwordInput');
  const openIcon = document.getElementById('eyeOpenIcon');
  const closedIcon = document.getElementById('eyeClosedIcon');
  if (input.type === 'password') {
    input.type = 'text';
    openIcon.style.display = 'none';
    closedIcon.style.display = 'block';
    document.getElementById('togglePasswordBtn').title = '隐藏密码';
  } else {
    input.type = 'password';
    openIcon.style.display = 'block';
    closedIcon.style.display = 'none';
    document.getElementById('togglePasswordBtn').title = '显示密码';
  }
}

function login() {
  const pwd = document.getElementById('passwordInput').value;
  if (!pwd) return;
  
  const loginBtn = document.getElementById('loginBtn');
  const originalText = loginBtn.textContent;
  loginBtn.textContent = '验证中...';
  loginBtn.disabled = true;
  document.getElementById('loginError').style.display = 'none';
  
  fetch(api('/api/list?password=' + encodeURIComponent(pwd) + '&page=1&pageSize=1'))
    .then(r => {
      if (!r.ok) throw new Error('密码错误');
      return r.json();
    })
    .then(data => {
      if (data.error) throw new Error(data.error);
      PASSWORD = pwd;
      document.getElementById('loginScreen').style.display = 'none';
      document.getElementById('dashboard').style.display = 'block';
      initCities();
      loadStats();
      loadList();
      loginBtn.textContent = originalText;
      loginBtn.disabled = false;
    })
    .catch(err => {
      const errEl = document.getElementById('loginError');
      errEl.textContent = '密码错误，请重试';
      errEl.style.display = 'block';
      loginBtn.textContent = originalText;
      loginBtn.disabled = false;
    });
}

function logout() {
  PASSWORD = '';
  document.getElementById('dashboard').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('passwordInput').value = '';
  document.getElementById('loginError').style.display = 'none';
}

function initCities() {
  const sel = document.getElementById('filterCity');
  CITIES.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c; opt.textContent = c;
    sel.appendChild(opt);
  });
}

function loadStats() {
  fetch(api('/api/stats?password=' + encodeURIComponent(PASSWORD)))
    .then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(data => {
      if (data.error) throw new Error(data.error);
      const container = document.getElementById('statsContainer');
      let html = '<div class="stat-card"><div class="num">' + data.total + '</div><div class="label">总计</div></div>';
      for (const [key, label] of Object.entries(STATUS_LABELS)) {
        html += '<div class="stat-card"><div class="num" style="color:' + STATUS_COLORS[key] + '">' + (data.byStatus[key] || 0) + '</div><div class="label">' + label + '</div></div>';
      }
      container.innerHTML = html;
      document.getElementById('totalCount').textContent = '共 ' + data.total + ' 条';
    })
    .catch(err => {
      console.error('loadStats error:', err);
      document.getElementById('statsContainer').innerHTML = '<div class="stat-card"><div class="num" style="color:#e74c3c">!</div><div class="label">加载失败: ' + err.message + '</div></div>';
    });
}

function loadList() {
  const params = new URLSearchParams({
    password: PASSWORD,
    page: currentPage,
    pageSize: 20,
    sort: document.getElementById('filterSort').value,
    city: document.getElementById('filterCity').value,
    status: document.getElementById('filterStatus').value,
    keyword: document.getElementById('filterKeyword').value,
  });

  fetch(api('/api/list?' + params.toString()))
    .then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(data => {
      if (data.error) throw new Error(data.error);
      renderTable(data);
      renderPagination(data);
    })
    .catch(err => {
      console.error('loadList error:', err);
      document.getElementById('tableBody').innerHTML = '<tr><td colspan="11" class="empty" style="color:#e74c3c">⚠️ 数据加载失败: ' + err.message + '</td></tr>';
    });
}

function renderTable(data) {
  const tbody = document.getElementById('tableBody');
  if (!data.list || data.list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="11" class="empty">暂无数据</td></tr>';
    return;
  }

  const esc = (s) => String(s).replace(/'/g, "&#39;").replace(/"/g, "&quot;");
  tbody.innerHTML = data.list.map(item =>
    '<tr data-id="' + esc(item.id) + '">' +
      '<td style="text-align:center;">' +
        (item.isPinned
          ? '<span class="pin-badge" style="cursor:pointer;font-size:16px;" title="取消置顶">📌</span>'
          : '<span class="pin-btn" style="cursor:pointer;font-size:14px;color:#999;opacity:0.5;" title="置顶">📍</span>') +
      '</td>' +
      '<td class="clickable" title="' + esc(item.id) + '">' + esc(item.id.substring(0, 12)) + '...</td>' +
      '<td>' + new Date(item.timestamp).toLocaleString('zh-CN') + '</td>' +
      '<td>' + esc(item.cinemaName) + '</td>' +
      '<td>' + esc(item.selectedCity) + (item.selectedCounty ? ' · ' + esc(item.selectedCounty) : '') + '</td>' +
      '<td>' + esc(item.reporterName) + (item.reporterTitle ? ' ' + esc(item.reporterTitle) : '') + '</td>' +
      '<td><span class="status-badge status-' + item.status + '">' + (STATUS_LABELS[item.status] || item.status) + '</span></td>' +
      '<td>' + item.hazardCount + '</td>' +
      '<td>' + item.photoCount + '</td>' +
      '<td><button class="clickable detail-btn" style="background:none;border:none;font-size:13px;cursor:pointer;color:#667eea;">查看详情</button></td>' +
      '<td style="text-align:center;"><button class="delete-btn" style="background:none;border:none;font-size:16px;cursor:pointer;color:#e74c3c;opacity:0.6;" title="删除">🗑️</button></td>' +
    '</tr>'
  ).join('');
  
  tbody._listenerAttached = tbody._listenerAttached || false;
  if (!tbody._listenerAttached) {
    tbody.addEventListener('click', function(e) {
      const row = e.target.closest('tr');
      if (!row) return;
      const id = row.getAttribute('data-id');
      if (!id) return;

      if (e.target.closest('.pin-btn') || e.target.closest('.pin-badge')) {
        togglePin(id);
        return;
      }

      if (e.target.closest('.delete-btn')) {
        deleteSubmission(id);
        return;
      }

      if (e.target.closest('.clickable')) {
        openDetail(id);
        return;
      }
    });
    tbody._listenerAttached = true;
  }
}

function renderPagination(data) {
  const container = document.getElementById('pagination');
  const totalPages = Math.ceil(data.total / data.pageSize) || 1;
  container.innerHTML =
    '<button onclick="goPage(' + (currentPage - 1) + ')" ' + (currentPage <= 1 ? 'disabled' : '') + '>上一页</button>' +
    '<span>第 ' + data.page + ' / ' + totalPages + ' 页（共 ' + data.total + ' 条）</span>' +
    '<button onclick="goPage(' + (currentPage + 1) + ')" ' + (currentPage >= totalPages ? 'disabled' : '') + '>下一页</button>';
}

function goPage(page) {
  if (page < 1) return;
  currentPage = page;
  loadList();
}

function togglePin(id) {
  fetch(api('/api/pin'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: PASSWORD, id }),
  })
    .then(r => {
      if (!r.ok) return r.json().then(d => { throw new Error(d.error || 'HTTP ' + r.status); });
      return r.json();
    })
    .then(data => {
      if (data.success) {
        loadList();
      } else {
        alert('操作失败：' + (data.error || '未知错误'));
      }
    })
    .catch(err => {
      console.error('togglePin error:', err);
      alert('操作失败: ' + err.message);
    });
}

function deleteSubmission(id) {
  if (!confirm('确定要删除此报告单吗？此操作不可恢复！')) return;
  
  fetch(api('/api/delete'), {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: PASSWORD, id }),
  })
    .then(r => {
      if (!r.ok) return r.json().then(d => { throw new Error(d.error || 'HTTP ' + r.status); });
      return r.json();
    })
    .then(data => {
      if (data.success) {
        alert('删除成功！');
        loadStats();
        loadList();
      } else {
        alert('删除失败：' + (data.error || '未知错误'));
      }
    })
    .catch(err => {
      console.error('deleteSubmission error:', err);
      alert('删除失败: ' + err.message);
    });
}

function openDetail(id) {
  fetch(api('/api/detail?id=' + encodeURIComponent(id) + '&password=' + encodeURIComponent(PASSWORD)))
    .then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(data => {
      if (data.error) { alert(data.error); return; }
      renderDetail(data);
      document.getElementById('detailModal').style.display = 'flex';
    })
    .catch(err => {
      console.error('openDetail error:', err);
      alert('加载详情失败: ' + err.message);
    });
}

function closeDetail() {
  document.getElementById('detailModal').style.display = 'none';
}

function previewImage(src) {
  document.getElementById('previewImage').src = src;
  document.getElementById('imagePreview').style.display = 'flex';
}

function renderDetail(data) {
  const container = document.getElementById('detailContent');
  const checkedHazards = Object.entries(data.hazards || {}).filter(([,v]) => v.checked);

  const esc = (s) => String(s).replace(/'/g, "&#39;").replace(/"/g, "&quot;");

  let hazardsHtml = '';
  if (checkedHazards.length > 0) {
    hazardsHtml = checkedHazards.map(([id]) => '<div class="hazard-item">✅ 隐患 #' + esc(id) + '</div>').join('');
  }
  if (data.othersText) {
    hazardsHtml += '<div class="hazard-item">📝 备注：' + esc(data.othersText) + '</div>';
  }

  const allPhotos = [...(data.photos || []), ...(data.othersPhotos || [])];
  let photosHtml = '';
  if (allPhotos.length > 0) {
    photosHtml = '<div class="photos-grid">' + allPhotos.map(p =>
      '<img src="' + esc(p.url || p) + '" onclick="previewImage(this.src)">'
    ).join('') + '</div>';
  }

  container.innerHTML =
    '<div class="field"><div class="field-label">ID</div><div class="field-value">' + esc(data.id) + '</div></div>' +
    '<div class="field"><div class="field-label">提交时间</div><div class="field-value">' + new Date(data.timestamp).toLocaleString('zh-CN') + '</div></div>' +
    '<div class="field"><div class="field-label">举报人</div><div class="field-value">' + esc(data.reporterName) + (data.reporterTitle ? ' ' + esc(data.reporterTitle) : '') + '</div></div>' +
    '<div class="field"><div class="field-label">手机号</div><div class="field-value">' + esc(data.reporterPhone) + '</div></div>' +
    '<div class="field"><div class="field-label">地区</div><div class="field-value">' + esc(data.selectedCity) + ' · ' + esc(data.selectedCounty || '未选择') + '</div></div>' +
    '<div class="field"><div class="field-label">影院</div><div class="field-value">' + esc(data.cinemaName) + '</div></div>' +
    '<div class="field"><div class="field-label">隐患项目</div>' + (hazardsHtml || '<div class="field-value">无</div>') + '</div>' +
    '<div class="field"><div class="field-label">照片 (' + allPhotos.length + '张)</div>' + (photosHtml || '<div class="field-value">无</div>') + '</div>' +
    '<div class="field" style="margin-top:16px;padding-top:16px;border-top:1px solid #eee;">' +
      '<div class="field-label">处理状态</div>' +
      '<select class="status-select" id="detailStatus">' +
        '<option value="pending"' + (data.status === 'pending' ? ' selected' : '') + '>待处理</option>' +
        '<option value="reviewing"' + (data.status === 'reviewing' ? ' selected' : '') + '>处理中</option>' +
        '<option value="resolved"' + (data.status === 'resolved' ? ' selected' : '') + '>已解决</option>' +
        '<option value="invalid"' + (data.status === 'invalid' ? ' selected' : '') + '>无效</option>' +
      '</select>' +
      '<button class="save-btn" id="saveStatusBtn">保存</button>' +
    '</div>' +
    '<div class="field">' +
      '<div class="field-label">备注</div>' +
      '<textarea id="detailNote">' + esc(data.note || '') + '</textarea>' +
    '</div>' +
    '<div class="field">' +
      '<div class="field-label">奖励金额 (元)</div>' +
      '<input type="number" id="detailReward" value="' + (data.rewardAmount || 0) + '" style="padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;width:120px;">' +
    '</div>';

  document.getElementById('detailTitle').textContent = '举报详情 - ' + data.cinemaName;
  
  const saveBtn = document.getElementById('saveStatusBtn');
  saveBtn.onclick = function() {
    saveStatus(data.id);
  };
}

function saveStatus(id) {
  const status = document.getElementById('detailStatus').value;
  const note = document.getElementById('detailNote').value;
  const rewardAmount = parseInt(document.getElementById('detailReward').value) || 0;

  fetch(api('/api/status'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: PASSWORD, id, status, note, rewardAmount }),
  })
    .then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(data => {
      if (data.success) {
        alert('保存成功！');
        closeDetail();
        loadStats();
        loadList();
      } else {
        alert('保存失败：' + (data.error || '未知错误'));
      }
    })
    .catch(err => {
      console.error('saveStatus error:', err);
      alert('保存失败: ' + err.message);
    });
}
</script>
</body>
</html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
}
