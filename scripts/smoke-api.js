const API = process.env.TEST_API_URL || 'http://localhost:3001/api';

async function call(method, path, token, body) {
  const res = await fetch(API + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

function check(name, result, expected = 200) {
  const ok = result.status === expected;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name} -> ${result.status}`);
  if (!ok) console.log(JSON.stringify(result.data).slice(0, 500));
  return ok;
}

(async () => {
  const login = await call('POST', '/auth/login', null, {
    email: 'admin@mineraaurora.com.ar', password: 'Demo1234!', tenantSlug: 'minera-aurora',
  });
  if (!check('login admin', login, 201)) process.exit(1);
  const token = login.data.accessToken;
  let allOk = true;

  for (const path of [
    '/auth/me', '/projects', '/mines', '/areas', '/shifts', '/crews', '/employees',
    '/equipment', '/equipment/categories', '/reports', '/production/units',
    '/production/indicators', '/production/targets', '/production/records',
    '/production/summary', '/dashboard', '/analytics/production-by-project',
    '/analytics/production-by-mine', '/analytics/production-by-shift',
    '/analytics/equipment-performance', '/analytics/targets-vs-actual',
    '/notifications', '/audit', '/users', '/tenants/' + login.data.user.tenantId,
  ]) {
    const r = await call('GET', path, token);
    allOk = check('GET ' + path, r) && allOk;
  }

  const mines = await call('GET', '/mines?limit=5', token);
  const indicators = await call('GET', '/production/indicators?limit=5', token);
  const units = await call('GET', '/production/units?limit=5', token);
  const shifts = await call('GET', '/shifts?limit=5', token);
  const employees = await call('GET', '/employees?limit=5', token);
  const equipment = await call('GET', '/equipment?limit=5', token);

  const mine = mines.data.data[0];
  const indicator = indicators.data.data[0];
  const unit = units.data.data.find((u) => u.id === indicator.unitId) || units.data.data[0];
  const shift = shifts.data.data[0];

  const created = await call('POST', '/reports', token, {
    projectId: mine.projectId,
    mineId: mine.id,
    shiftId: shift.id,
    date: new Date().toISOString().slice(0, 10),
    observations: 'Parte creado por prueba automatizada',
    activities: [{ description: 'Extracción de prueba', hours: 2 }],
    production: [{ indicatorId: indicator.id, unitId: unit.id, value: 123.456 }],
    employees: employees.data.data.slice(0, 1).map((e) => ({ employeeId: e.id, hours: 2 })),
    equipment: equipment.data.data.slice(0, 1).map((e) => ({ equipmentId: e.id, hours: 2 })),
  });
  allOk = check('POST /reports anidado', created, 201) && allOk;
  const reportId = created.data.id;

  if (reportId) {
    allOk = check('POST /reports/:id/submit', await call('POST', `/reports/${reportId}/submit`, token, {}), 201) && allOk;
    allOk = check('POST /reports/:id/approve', await call('POST', `/reports/${reportId}/approve`, token, { comments: 'Aprobado en prueba' }), 201) && allOk;
    allOk = check('GET /reports/:id/revisions', await call('GET', `/reports/${reportId}/revisions`, token)) && allOk;
    const patch = await call('PATCH', `/reports/${reportId}`, token, { observations: 'Rectificación auditada', rectificationReason: 'Prueba de corrección' });
    allOk = check('PATCH reporte aprobado con rectificación', patch) && allOk;
  }

  const other = await call('POST', '/auth/login', null, {
    email: 'admin@andescopper.com.ar', password: 'Demo1234!', tenantSlug: 'andes-copper',
  });
  if (check('login otro tenant', other, 201)) {
    const cross = await call('GET', `/reports/${reportId || 'x'}`, other.data.accessToken);
    allOk = check('aislamiento cross-tenant', cross, 404) && allOk;
    const crossMine = await call('POST', '/mines', other.data.accessToken, {
      projectId: mine.projectId, code: 'INTRUSO', name: 'Mina intrusa', mode: 'OPEN_PIT',
    });
    allOk = check('FK cross-tenant rechazada', crossMine, 400) && allOk;
  }

  const superLogin = await call('POST', '/auth/login', null, {
    email: 'superadmin@miningmanager.com.ar', password: 'Demo1234!', tenantSlug: 'minera-aurora',
  });
  allOk = check('login superadmin en tenant', superLogin, 201) && allOk;
  if (superLogin.status === 201) {
    allOk = check('superadmin ve proyectos del tenant', await call('GET', '/projects', superLogin.data.accessToken)) && allOk;
  }

  console.log(allOk ? '\nTODAS LAS PRUEBAS PASARON' : '\nHUBO FALLOS');
  process.exit(allOk ? 0 : 1);
})();
