const API = process.env.TEST_API_URL || 'http://localhost:3001/api';

(async () => {
  const login = await fetch(API + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@mineraaurora.cl', password: 'Demo1234!', tenantSlug: 'minera-aurora' }),
  }).then((r) => r.json());
  const token = login.accessToken;
  const auth = { Authorization: `Bearer ${token}` };

  let ok = true;
  for (const format of ['csv', 'xlsx']) {
    const res = await fetch(`${API}/analytics/export?type=production-by-project&format=${format}`, { headers: auth });
    const buffer = Buffer.from(await res.arrayBuffer());
    const good = res.status === 200 && buffer.length > 50;
    console.log(`${good ? 'OK  ' : 'FAIL'} export ${format} -> ${res.status}, ${buffer.length} bytes, ${res.headers.get('content-type')}`);
    ok = ok && good;
  }

  const reports = await fetch(API + '/reports?limit=1', { headers: auth }).then((r) => r.json());
  const reportId = reports.data[0].id;
  const form = new FormData();
  form.append('file', new Blob(['evidencia de prueba\n'], { type: 'text/plain' }), 'evidencia.txt');
  const upload = await fetch(`${API}/reports/${reportId}/attachments`, { method: 'POST', headers: auth, body: form });
  const attachment = await upload.json();
  const uploadOk = upload.status === 201 && attachment.url;
  console.log(`${uploadOk ? 'OK  ' : 'FAIL'} upload attachment -> ${upload.status}`);
  ok = ok && uploadOk;

  if (attachment.url) {
    const origin = new URL(API).origin;
    const download = await fetch(origin + attachment.url, { headers: auth });
    const body = await download.text();
    const downloadOk = download.status === 200 && body.includes('evidencia de prueba');
    console.log(`${downloadOk ? 'OK  ' : 'FAIL'} download attachment -> ${download.status}`);
    ok = ok && downloadOk;
  }

  console.log(ok ? '\nARCHIVOS OK' : '\nFALLOS EN ARCHIVOS');
  process.exit(ok ? 0 : 1);
})();
