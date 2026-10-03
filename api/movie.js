const https = require('https')
const crypto = require('crypto')
const { URL } = require('url')

const H5 = 'https://h5-api.aoneroom.com/wefeed-h5api-bff'
const MOBILE = 'https://api3.aoneroom.com'
const HOST = 'officialmoviebox.com'
const GATEWAY_B64 = '76iRl07s0xSN9jqmEWAt79EBJZulIQIsV64FZr2O'
const GATEWAY_KEY = Buffer.from(GATEWAY_B64, 'base64')
const UA_H5 = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
const UA_MOB = 'com.community.oneroom/50020126 (Linux; U; Android 14; en_US; Pixel 6; Build/UQ1A)'

let guestJwt = null

function md5hex(s) {
  return crypto.createHash('md5').update(s).digest('hex')
}

function clientToken() {
  const ts = String(Date.now())
  return ts + ',' + md5hex(ts.split('').reverse().join(''))
}

function clientInfo() {
  return JSON.stringify({
    package_name: 'com.community.oneroom',
    version_name: '4.0.02',
    version_code: 50020126,
    os: 'android',
    os_version: '14',
    device_id: '868203051234567',
    brand: 'Google',
    model: 'Pixel 6',
    system_language: 'en',
    net: 'wifi',
    region: 'IN',
    timezone: 'Asia/Kolkata',
    sp_code: '404'
  })
}

function trSignature(method, fullUrl, body) {
  const ts = Date.now()
  const u = new URL(fullUrl)
  const params = [...u.searchParams.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  const qs = params.map(([k, v]) => k + '=' + v).join('&')
  const resource = u.pathname + (qs ? '?' + qs : '')
  const bodyStr = body || ''
  const bodyMd5 = bodyStr ? md5hex(bodyStr.slice(0, 0x19000)) : ''
  const canon = [
    method.toUpperCase(),
    'application/json',
    'application/json;charset=UTF-8',
    bodyStr ? String(bodyStr.length) : '',
    String(ts),
    bodyMd5,
    resource
  ].join('\n')
  const dig = crypto.createHmac('md5', GATEWAY_KEY).update(canon).digest('base64')
  return ts + '|2|' + dig
}

// === FONDASI HTTP BAWAAN NODE.JS (YANG KEMAREN KEHAPUS) ===
function httpGet(url, headers) {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'GET',
      headers: headers,
      timeout: 25000
    }, res => {
      let data = ''
      res.setEncoding('utf8')
      res.on('data', c => data += c)
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }))
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
    req.end()
  })
}

function httpPost(url, headers, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const payload = body || ''
    const h = Object.assign({}, headers, {
      'Content-Length': Buffer.byteLength(payload)
    })
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'POST',
      headers: h,
      timeout: 25000
    }, res => {
      let data = ''
      res.setEncoding('utf8')
      res.on('data', c => data += c)
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }))
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
    req.write(payload)
    req.end()
  })
}

// === FUNGSI API BYPASS CLOUDFLARE (JUALAN LU) ===
async function mobileGet(path) {
  const originalUrl = MOBILE + path;
  const bypassUrl = 'https://api.jerexd.my.id/api/tools/cfwaf?apikey=seven-api&mode=waf&url=' + encodeURIComponent(originalUrl);
  
  const headers = {
    'User-Agent': UA_MOB,
    Accept: 'application/json',
    'Content-Type': 'application/json;charset=UTF-8',
    'X-M-Version': '4.0.02',
    'X-Client-Token': clientToken(),
    'X-Client-Info': clientInfo(),
    'X-Client-Status': '0',
    'x-tr-signature': trSignature('GET', originalUrl)
  };
  
  if (guestJwt) headers.Authorization = 'Bearer ' + guestJwt;
  
  return httpGet(bypassUrl, headers);
}

async function mobilePost(path, bodyObj) {
  const originalUrl = MOBILE + path;
  const bypassUrl = 'https://api.jerexd.my.id/api/tools/cfwaf?apikey=seven-api&mode=waf&url=' + encodeURIComponent(originalUrl);
  const body = JSON.stringify(bodyObj || {});
  
  const headers = {
    'User-Agent': UA_MOB,
    Accept: 'application/json',
    'Content-Type': 'application/json;charset=UTF-8',
    'X-M-Version': '4.0.02',
    'X-Client-Token': clientToken(),
    'X-Client-Info': clientInfo(),
    'X-Client-Status': '0',
    'x-tr-signature': trSignature('POST', originalUrl, body)
  };
  
  if (guestJwt) headers.Authorization = 'Bearer ' + guestJwt;
  
  return httpPost(bypassUrl, headers, body);
}

// === SISA FUNGSI MOVIEBOX ===
async function ensureGuest() {
  if (guestJwt) return guestJwt
  const r = await mobileGet('/wefeed-mobile-bff/tab-operating?page=1&tabId=0')
  const raw = r.headers['x-user'] || r.headers['X-User'] || ''
  try {
    guestJwt = JSON.parse(raw).token
  } catch (_) {
    guestJwt = raw.startsWith('ey') ? raw : null
  }
  
  if (!guestJwt) {
    throw new Error(`guest bootstrap failed. Status Bypass: ${r.status} | Body: ${r.body.slice(0, 150)}...`)
  }
  
  return guestJwt
}

function h5Get(path) {
  const url = path.startsWith('http') ? path : H5 + path
  return httpGet(url, {
    'User-Agent': UA_H5,
    Accept: 'application/json',
    Referer: 'https://' + HOST + '/',
    Origin: 'https://' + HOST
  }).then(r => {
    try { return JSON.parse(r.body) } catch (e) { throw new Error('bad json') }
  })
}

function decodeSignCookie(sc) {
  if (!sc) return null
  const m = String(sc).match(/urlprefix=([^:]+)/)
  if (!m) return null
  try {
    const prefix = Buffer.from(m[1], 'base64').toString('utf8')
    return {
      prefix,
      mpd: prefix.replace(/\/?$/, '/') + 'index.mpd',
      m3u8: prefix.replace(/\/?$/, '/') + 'index.m3u8'
    }
  } catch (_) {
    return null
  }
}

async function home() {
  const j = await h5Get('/home?host=' + HOST)
  if (j.code !== 0) throw new Error(j.message || 'api error')
  const ops = (j.data && j.data.operatingList) || []
  const out = { platforms: (j.data && j.data.platformList) || [], sections: [] }
  for (const sec of ops) {
    const items = []
    if (sec.banner && sec.banner.items) {
      for (const b of sec.banner.items) {
        const s = b.subject || {}
        items.push({
          subjectId: s.subjectId || b.subjectId,
          title: s.title || b.title,
          type: s.subjectType,
          cover: (s.cover && s.cover.url) || (b.image && b.image.url),
          imdb: s.imdbRatingValue,
          genre: s.genre,
          releaseDate: s.releaseDate
        })
      }
    }
    if (sec.subjects) {
      for (const s of sec.subjects) {
        items.push({
          subjectId: s.subjectId,
          title: s.title,
          type: s.subjectType,
          cover: s.cover && s.cover.url,
          imdb: s.imdbRatingValue,
          genre: s.genre,
          releaseDate: s.releaseDate
        })
      }
    }
    out.sections.push({ type: sec.type, title: sec.title, position: sec.position, items })
  }
  return out
}

async function trending(page) {
  const j = await h5Get('/subject/trending?page=' + (page || 0) + '&perPage=18')
  if (j.code !== 0) throw new Error(j.message || 'api error')
  return ((j.data && j.data.subjectList) || []).map(s => ({
    subjectId: s.subjectId,
    title: s.title,
    type: s.subjectType,
    cover: s.cover && s.cover.url,
    imdb: s.imdbRatingValue,
    genre: s.genre,
    releaseDate: s.releaseDate,
    country: s.countryName,
    hasResource: s.hasResource
  }))
}

async function search(q, page) {
  await ensureGuest()
  const pageNum = Math.max(1, parseInt(page, 10) || 1)
  const r = await mobilePost('/wefeed-mobile-bff/subject-api/search', {
    keyword: String(q),
    page: pageNum,
    pageSize: 20,
    type: 0
  })
  let j
  try { j = JSON.parse(r.body) } catch (_) { throw new Error('search bad json. Body: ' + r.body.slice(0, 100)) }
  if (j.code !== 0) throw new Error(j.message || ('search error ' + r.status))
  const d = j.data || {}
  const items = (d.items || []).map(s => ({
    subjectId: s.subjectId,
    title: s.title,
    type: s.subjectType,
    genre: s.genre,
    country: s.countryName,
    language: s.language,
    releaseDate: s.releaseDate,
    imdb: s.imdbRatingValue,
    cover: s.cover && s.cover.url,
    description: (s.description || '').slice(0, 200)
  }))
  return {
    query: q,
    page: pageNum,
    total: (d.pager && d.pager.totalCount) || items.length,
    hasMore: !!(d.pager && d.pager.hasMore),
    results: items
  }
}

async function detail(id) {
  const j = await h5Get('/detail?subjectId=' + id)
  if (j.code !== 0) throw new Error(j.message || 'api error')
  const s = (j.data && j.data.subject) || {}
  return {
    subjectId: s.subjectId,
    title: s.title,
    type: s.subjectType,
    description: s.description,
    releaseDate: s.releaseDate,
    duration: s.duration,
    genre: s.genre,
    cover: s.cover && s.cover.url,
    country: s.countryName,
    imdb: s.imdbRatingValue,
    subtitles: s.subtitles,
    hasResource: s.hasResource,
    trailer: s.trailer && s.trailer.videoAddress && s.trailer.videoAddress.url
  }
}

async function play(id, se, ep) {
  se = se === undefined ? 0 : +se
  ep = ep === undefined ? 0 : +ep
  await ensureGuest()
  const path = '/wefeed-mobile-bff/subject-api/play-info?subjectId=' + id + '&se=' + se + '&ep=' + ep
  const r = await mobileGet(path)
  let j
  try { j = JSON.parse(r.body) } catch (_) { throw new Error('play bad json ' + r.body.slice(0, 100)) }
  if (j.code !== 0) throw new Error(j.message || 'play error ' + r.status)

  const d = j.data || {}
  const streams = []
  for (const s of (d.streams || [])) {
    const decoded = decodeSignCookie(s.signCookie)
    streams.push({
      format: s.format,
      id: s.id,
      resolutions: s.resolutions,
      size: s.size,
      duration: s.duration,
      codec: s.codecName,
      trapUrl: s.url,
      signCookie: s.signCookie,
      dash: decoded && decoded.mpd,
      hls: decoded && decoded.m3u8,
      prefix: decoded && decoded.prefix,
      cookieHeader: s.signCookie ? ('Edge-Cache-Cookie=' + String(s.signCookie).replace(/^Edge-Cache-Cookie=/, '')) : null
    })
  }

  return {
    subjectId: id,
    se,
    ep,
    title: d.title,
    streams,
    playUrl: streams[0] && streams[0].dash,
    playHls: streams[0] && streams[0].hls,
    note: streams.length
      ? 'pakai dash/hls + Cookie header dari cookieHeader. trapUrl = dummy jangan dipakai'
      : 'no streams'
  }
}

// Mode Vercel API
module.exports = async (req, res) => {
  const { action, id, se, ep, page, keyword } = req.query;

  try {
    if (action === 'home') {
      return res.status(200).json(await home());
    } 
    else if (action === 'trending') {
      return res.status(200).json(await trending(page || 0));
    } 
    else if (action === 'search' && keyword) {
      return res.status(200).json(await search(keyword, page || 1));
    }
    else if (action === 'detail' && id) {
      return res.status(200).json(await detail(id));
    } 
    else if (action === 'play' && id) {
      return res.status(200).json(await play(id, se || 0, ep || 0));
    } 
    else {
      return res.status(400).json({ error: 'Action tidak valid atau parameter kurang' });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
