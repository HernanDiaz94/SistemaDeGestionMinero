import request from 'supertest';

/**
 * Prueba de humo HTTP. Requiere el backend en ejecución y la semilla aplicada.
 * Ejecutar: npm run test:e2e --workspace=backend
 */
const API = process.env.TEST_API_URL || 'http://localhost:3001/api';

describe('Flujo de autenticación (e2e)', () => {
  it('rechaza credenciales inválidas', async () => {
    const response = await request(API)
      .post('/auth/login')
      .send({ email: 'no-existe@test.cl', password: 'mala-contrasena' });
    expect(response.status).toBe(401);
  });

  it('permite iniciar sesión y consultar el perfil', async () => {
    const login = await request(API)
      .post('/auth/login')
      .send({
        email: 'admin@mineraaurora.cl',
        password: 'Demo1234!',
        tenantSlug: 'minera-aurora',
      });
    expect(login.status).toBe(201);
    expect(login.body.accessToken).toBeDefined();

    const me = await request(API)
      .get('/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.permissions).toContain('projects.read');
  });

  it('bloquea recursos sin token', async () => {
    const response = await request(API).get('/projects');
    expect(response.status).toBe(401);
  });
});
