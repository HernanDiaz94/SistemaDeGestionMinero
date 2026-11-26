import {
  ApprovalDecision,
  AssignmentStatus,
  AttachmentKind,
  AuditAction,
  EmployeeStatus,
  EmploymentType,
  EquipmentStatus,
  GlobalRole,
  MineMode,
  MineStatus,
  ModuleKey,
  ProjectStatus,
  ReportStatus,
  ShiftType,
  SubscriptionStatus,
  TargetPeriod,
  TenantStatus,
  UserStatus,
} from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { ALL_PERMISSIONS, MODULE_KEYS, ROLE_PERMISSIONS } from '../src/common/auth/permissions';

const prisma = new PrismaClient();
const PASSWORD = 'Demo1234!';
const TZ = 'America/Santiago';

function daysAgo(days: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

async function main() {
  console.log('Seeding Mining Manager...');

  // ---------------------------------------------------------------- permisos
  for (const key of ALL_PERMISSIONS) {
    const [module, ...rest] = key.split('.');
    await prisma.permission.upsert({
      where: { key },
      create: { key, module: module.toLowerCase(), action: rest.join('.'), description: key },
      update: {},
    });
  }

  for (const [key, permissions] of Object.entries(ROLE_PERMISSIONS)) {
    let role = await prisma.role.findFirst({ where: { tenantId: null, key } });
    if (!role) {
      role = await prisma.role.create({
        data: {
          tenantId: null,
          key,
          name: key.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()),
          isSystem: true,
          description: `Rol del sistema ${key}`,
        },
      });
    } else if (!role.isSystem) {
      role = await prisma.role.update({ where: { id: role.id }, data: { isSystem: true } });
    }
    for (const permissionKey of permissions) {
      const permission = await prisma.permission.findUniqueOrThrow({ where: { key: permissionKey } });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        create: { roleId: role.id, permissionId: permission.id },
        update: {},
      });
    }
  }

  // ------------------------------------------------------------ superusuario
  const superadmin = await prisma.user.upsert({
    where: { email: 'superadmin@miningmanager.com' },
    create: {
      email: 'superadmin@miningmanager.com',
      passwordHash: await bcrypt.hash(PASSWORD, 10),
      firstName: 'Super',
      lastName: 'Administrador',
      globalRole: GlobalRole.SUPERADMIN,
    },
    update: { passwordHash: await bcrypt.hash(PASSWORD, 10), globalRole: GlobalRole.SUPERADMIN },
  });

  await seedTenant({
    name: 'Minera Aurora',
    slug: 'minera-aurora',
    legalName: 'Minera Aurora SpA',
    taxId: '76.123.456-7',
    adminEmail: 'admin@mineraaurora.cl',
    supervisorEmail: 'supervisor@mineraaurora.cl',
    projects: [
      { code: 'PA-01', name: 'Proyecto Cobre Norte', mines: [
        { code: 'M-A', name: 'Yacimiento Cobre Norte', mode: MineMode.OPEN_PIT },
        { code: 'M-B', name: 'Yacimiento Subterráneo El Toro', mode: MineMode.UNDERGROUND },
      ] },
      { code: 'PA-02', name: 'Proyecto Diablas', mines: [
        { code: 'M-C', name: 'Yacimiento Diablas', mode: MineMode.OPEN_PIT },
      ] },
    ],
    employeeCount: 12,
    equipmentCount: 8,
    reportCount: 8,
  });

  await seedTenant({
    name: 'Andes Copper',
    slug: 'andes-copper',
    legalName: 'Andes Copper S.A.',
    taxId: '77.987.654-3',
    adminEmail: 'admin@andescopper.cl',
    supervisorEmail: 'supervisor@andescopper.cl',
    projects: [
      { code: 'AC-01', name: 'Proyecto Cerro Verde', mines: [
        { code: 'CV-1', name: 'Mina Cerro Verde', mode: MineMode.OPEN_PIT },
        { code: 'CV-2', name: 'Nivel 4 Cerro Verde', mode: MineMode.UNDERGROUND },
      ] },
    ],
    employeeCount: 8,
    equipmentCount: 5,
    reportCount: 4,
  });

  console.log('Seed completado.');
  console.log(`Superadmin: ${superadmin.email} / ${PASSWORD}`);
  console.log(`Admin Aurora: admin@mineraaurora.cl / ${PASSWORD}`);
}

type SeedTenantParams = {
  name: string;
  slug: string;
  legalName: string;
  taxId: string;
  adminEmail: string;
  supervisorEmail: string;
  projects: Array<{
    code: string;
    name: string;
    mines: Array<{ code: string; name: string; mode: MineMode }>;
  }>;
  employeeCount: number;
  equipmentCount: number;
  reportCount: number;
};

async function seedTenant(params: SeedTenantParams) {
  const tenant = await prisma.tenant.upsert({
    where: { slug: params.slug },
    create: {
      name: params.name,
      slug: params.slug,
      legalName: params.legalName,
      taxId: params.taxId,
      timezone: TZ,
      status: TenantStatus.ACTIVE,
    },
    update: { name: params.name, timezone: TZ, status: TenantStatus.ACTIVE },
  });

  for (const key of MODULE_KEYS) {
    await prisma.tenantModule.upsert({
      where: { tenantId_key: { tenantId: tenant.id, key: key as ModuleKey } },
      create: { tenantId: tenant.id, key: key as ModuleKey, enabled: true },
      update: { enabled: true },
    });
  }

  const existingSubscription = await prisma.subscription.findFirst({ where: { tenantId: tenant.id } });
  if (!existingSubscription) {
    await prisma.subscription.create({
      data: {
        tenantId: tenant.id,
        plan: 'professional',
        status: SubscriptionStatus.ACTIVE,
        maxUsers: 50,
        startDate: daysAgo(120),
      },
    });
  }

  // Roles del tenant: se usan los roles globales del sistema.
  const makeUser = async (email: string, firstName: string, lastName: string, roleKey: string) => {
    const user = await prisma.user.upsert({
      where: { email },
      create: {
        email,
        passwordHash: await bcrypt.hash(PASSWORD, 10),
        firstName,
        lastName,
        globalRole: GlobalRole.USER,
      },
      update: { passwordHash: await bcrypt.hash(PASSWORD, 10) },
    });
    const tenantUser = await prisma.tenantUser.upsert({
      where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
      create: { tenantId: tenant.id, userId: user.id, status: UserStatus.ACTIVE },
      update: { status: UserStatus.ACTIVE },
    });
    const role = await prisma.role.findFirstOrThrow({
      where: { tenantId: null, key: roleKey },
    });
    await prisma.tenantUserRole.upsert({
      where: { tenantUserId_roleId: { tenantUserId: tenantUser.id, roleId: role.id } },
      create: { tenantUserId: tenantUser.id, roleId: role.id },
      update: {},
    });
    return { user, tenantUser };
  };

  const admin = await makeUser(params.adminEmail, 'María', 'González', 'ADMIN_EMPRESARIAL');
  const supervisor = await makeUser(params.supervisorEmail, 'Carlos', 'Muñoz', 'SUPERVISOR');
  const operator = await makeUser(
    params.supervisorEmail.replace('supervisor@', 'operador@'),
    'Luis',
    'Fuentes',
    'OPERADOR',
  );

  // --------------------------------------------------------------- proyectos
  const projects: any[] = [];
  for (const projectSeed of params.projects) {
    let project = await prisma.project.findFirst({
      where: { tenantId: tenant.id, code: projectSeed.code },
    });
    if (!project) {
      project = await prisma.project.create({
        data: {
          tenantId: tenant.id,
          code: projectSeed.code,
          name: projectSeed.name,
          status: ProjectStatus.ACTIVE,
          startDate: daysAgo(180),
        },
      });
    }
    projects.push(project);

    for (const mineSeed of projectSeed.mines) {
      let mine = await prisma.mine.findFirst({
        where: { tenantId: tenant.id, projectId: project.id, code: mineSeed.code },
      });
      if (!mine) {
        mine = await prisma.mine.create({
          data: {
            tenantId: tenant.id,
            projectId: project.id,
            code: mineSeed.code,
            name: mineSeed.name,
            mode: mineSeed.mode,
            status: MineStatus.ACTIVE,
            latitude: -23.5,
            longitude: -70.2,
          },
        });
      }

      const areaTypes =
        mineSeed.mode === MineMode.OPEN_PIT
          ? [
              ['BENCH', 'Banco 1'],
              ['PHASE', 'Fase 2'],
              ['EXTRACTION_FRONT', 'Frente Este'],
              ['HAUL_ROAD', 'Ruta de acarreo principal'],
            ]
          : [
              ['LEVEL', 'Nivel 4'],
              ['DRIFT', 'Galería principal'],
              ['RAMP', 'Rampa de acceso'],
              ['ADVANCE_FRONT', 'Frente de avance Norte'],
            ];
      for (let i = 0; i < areaTypes.length; i++) {
        const [type, name] = areaTypes[i];
        await prisma.mineArea.upsert({
          where: { tenantId_mineId_code: { tenantId: tenant.id, mineId: mine.id, code: `${mineSeed.code}-A${i + 1}` } },
          create: {
            tenantId: tenant.id,
            mineId: mine.id,
            code: `${mineSeed.code}-A${i + 1}`,
            name,
            type: type as any,
            status: EmployeeStatus.ACTIVE,
          },
          update: {},
        });
      }
    }
  }

  // -------------------------------------------------------- turnos y cuadrillas
  const dayShift = await prisma.shift.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'TURNO-A' } },
    create: {
      tenantId: tenant.id,
      code: 'TURNO-A',
      name: 'Turno Día',
      type: ShiftType.DAY,
      startTime: '07:00',
      endTime: '19:00',
      status: EmployeeStatus.ACTIVE,
    },
    update: {},
  });
  const nightShift = await prisma.shift.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'TURNO-B' } },
    create: {
      tenantId: tenant.id,
      code: 'TURNO-B',
      name: 'Turno Noche',
      type: ShiftType.NIGHT,
      startTime: '19:00',
      endTime: '07:00',
      status: EmployeeStatus.ACTIVE,
    },
    update: {},
  });

  const crews: any[] = [];
  for (let i = 0; i < 3; i++) {
    crews.push(
      await prisma.crew.upsert({
        where: { tenantId_projectId_code: { tenantId: tenant.id, projectId: projects[0].id, code: `CUAD-${i + 1}` } },
        create: {
          tenantId: tenant.id,
          projectId: projects[0].id,
          code: `CUAD-${i + 1}`,
          name: `Cuadrilla ${i + 1}`,
          shiftId: i % 2 === 0 ? dayShift.id : nightShift.id,
          status: EmployeeStatus.ACTIVE,
        },
        update: {},
      }),
    );
  }

  // ---------------------------------------------------------------- empleados
  const firstNames = ['Ana', 'Pedro', 'Diego', 'Sofía', 'Jorge', 'Rosa', 'Iván', 'Camila', 'Pablo', 'Lucía', 'Andrés', 'Valeria'];
  const lastNames = ['Rojas', 'Silva', 'Pérez', 'Torres', 'Vargas', 'Mena', 'Castro', 'Flores', 'López', 'Herrera', 'Ruiz', 'Soto'];
  const positions = ['Supervisor de operación', 'Operador de excavadora', 'Chofer de camión', 'Perforador', 'Geólogo', 'Técnico de mantenimiento'];
  const employees: any[] = [];
  for (let i = 0; i < params.employeeCount; i++) {
    const code = `${params.slug.toUpperCase().slice(0, 2)}-E${String(i + 1).padStart(3, '0')}`;
    let employee = await prisma.employee.findFirst({ where: { tenantId: tenant.id, code } });
    if (!employee) {
      employee = await prisma.employee.create({
        data: {
          tenantId: tenant.id,
          projectId: projects[i % projects.length].id,
          crewId: crews[i % crews.length].id,
          shiftId: i % 2 === 0 ? dayShift.id : nightShift.id,
          code,
          firstName: firstNames[i % firstNames.length],
          lastName: lastNames[i % lastNames.length],
          documentType: 'DNI',
          documentNumber: `${15000000 + i * 137}`,
          email: `${code.toLowerCase()}@example.cl`,
          position: positions[i % positions.length],
          company: i % 4 === 0 ? 'Contratista Andes Limitada' : params.name,
          type: i % 4 === 0 ? EmploymentType.CONTRACTOR : EmploymentType.EMPLOYEE,
          status: EmployeeStatus.ACTIVE,
          hiredAt: daysAgo(400 - i * 10),
          documents: [{ type: 'contrato', issuedAt: daysAgo(400 - i * 10).toISOString() }],
        },
      });
    }
    employees.push(employee);
  }

  // ------------------------------------------------------------- maquinaria
  const categoryNames = ['Excavadoras', 'Camiones', 'Perforadoras', 'Cargadores'];
  const categories: any[] = [];
  for (const name of categoryNames) {
    const code = name.substring(0, 3).toUpperCase();
    categories.push(
      await prisma.equipmentCategory.upsert({
        where: { tenantId_code: { tenantId: tenant.id, code } },
        create: { tenantId: tenant.id, code, name },
        update: {},
      }),
    );
  }
  const equipmentModels = [
    ['EX-01', 'Excavadora', 'CAT', '336'],
    ['EX-02', 'Excavadora', 'Komatsu', 'PC210'],
    ['CM-01', 'Camión', 'Volvo', 'A40'],
    ['CM-02', 'Camión', 'CAT', '777G'],
    ['PF-01', 'Perforadora', 'Atlas Copco', 'ROC L6'],
    ['CG-01', 'Cargador', 'CAT', '966H'],
    ['CM-03', 'Camión', 'Volvo', 'A45'],
    ['EX-03', 'Excavadora', 'Hitachi', 'EX1200'],
  ];
  const equipment: any[] = [];
  for (let i = 0; i < params.equipmentCount; i++) {
    const [code, name, brand, model] = equipmentModels[i % equipmentModels.length];
    let item = await prisma.equipment.findFirst({ where: { tenantId: tenant.id, code } });
    if (!item) {
      item = await prisma.equipment.create({
        data: {
          tenantId: tenant.id,
          categoryId: categories[i % categories.length].id,
          projectId: projects[i % projects.length].id,
          responsibleId: employees[i % employees.length].id,
          code,
          name: `${name} ${model}`,
          brand,
          model,
          serialNumber: `SN-${params.slug}-${i + 1}`,
          status: i === 2 ? EquipmentStatus.MAINTENANCE : EquipmentStatus.OPERATIONAL,
          operatingHours: 1200 + i * 85,
          purchaseDate: daysAgo(900 - i * 30),
        },
      });
    }
    equipment.push(item);

    if (!(await prisma.equipmentReading.findFirst({ where: { tenantId: tenant.id, equipmentId: item.id } }))) {
      await prisma.equipmentReading.create({
        data: {
          tenantId: tenant.id,
          equipmentId: item.id,
          readAt: daysAgo(1),
          hours: 1200 + i * 85,
          recordedByUserId: supervisor.user.id,
          notes: 'Lectura inicial de demostración',
        },
      });
      await prisma.fuelRecord.create({
        data: {
          tenantId: tenant.id,
          equipmentId: item.id,
          date: daysAgo(1),
          liters: 180 + i * 12,
          cost: 950 + i * 60,
          station: 'Estación de combustible faena',
          recordedByUserId: supervisor.user.id,
        },
      });
    }
    await prisma.equipmentAssignment.upsert({
      where: { id: `demo-assignment-${item.id}` },
      create: {
        id: `demo-assignment-${item.id}`,
        tenantId: tenant.id,
        equipmentId: item.id,
        projectId: projects[i % projects.length].id,
        employeeId: employees[i % employees.length].id,
        startDate: daysAgo(60),
        status: AssignmentStatus.ACTIVE,
      },
      update: {},
    });
  }

  // ------------------------------------- unidades, indicadores y objetivos
  const unitData = [
    ['TON', 'Tonelada', 't', 'MASS', 1],
    ['M3', 'Metro cúbico', 'm³', 'VOLUME', 1],
    ['MT', 'Metro', 'm', 'LENGTH', 1],
    ['HR', 'Hora', 'h', 'TIME', 1],
    ['UND', 'Unidad', 'u', 'COUNT', 1],
  ] as const;
  const units: Record<string, string> = {};
  for (const [code, name, symbol, category, factor] of unitData) {
    const unit = await prisma.productionUnit.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code } },
      create: { tenantId: tenant.id, code, name, symbol, category: category as any, factorToBaseUnit: factor },
      update: {},
    });
    units[code] = unit.id;
  }

  const indicatorData = [
    ['EXTRACTED_TONNES', 'Toneladas extraídas', 'TON'],
    ['TRANSPORTED_TONNES', 'Toneladas transportadas', 'TON'],
    ['PROCESSED_TONNES', 'Toneladas procesadas', 'TON'],
    ['ADVANCE_METERS', 'Metros de avance', 'MT'],
    ['DRILLING_COUNT', 'Cantidad de perforaciones', 'UND'],
    ['OPERATION_HOURS', 'Horas de operación', 'HR'],
    ['MATERIAL_VOLUME', 'Volumen de material', 'M3'],
  ] as const;
  const indicators: Record<string, string> = {};
  for (const [code, name, unitCode] of indicatorData) {
    const category = unitData.find((u) => u[0] === unitCode)![3];
    const indicator = await prisma.productionIndicator.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code } },
      create: {
        tenantId: tenant.id,
        code,
        name,
        unitId: units[unitCode],
        category: category as any,
        description: `Indicador operativo ${name.toLowerCase()}`,
      },
      update: {},
    });
    indicators[code] = indicator.id;
  }

  const now = new Date();
  for (const [index, indicatorId] of Object.values(indicators).entries()) {
    await prisma.productionTarget.upsert({
      where: { id: `demo-target-${tenant.id}-${index}` },
      create: {
        id: `demo-target-${tenant.id}-${index}`,
        tenantId: tenant.id,
        projectId: projects[0].id,
        indicatorId,
        period: TargetPeriod.MONTHLY,
        year: now.getUTCFullYear(),
        month: now.getUTCMonth() + 1,
        targetValue: 1000 + index * 250,
        createdByUserId: admin.user.id,
      },
      update: {},
    });
  }

  // ------------------------------------------------------ partes diarios
  const mines = await prisma.mine.findMany({ where: { tenantId: tenant.id }, orderBy: { code: 'asc' } });
  const areas = await prisma.mineArea.findMany({ where: { tenantId: tenant.id }, orderBy: { code: 'asc' } });
  const shifts = await prisma.shift.findMany({ where: { tenantId: tenant.id }, orderBy: { code: 'asc' } });
  const statuses = [
    ReportStatus.APPROVED,
    ReportStatus.APPROVED,
    ReportStatus.APPROVED,
    ReportStatus.SUBMITTED,
    ReportStatus.UNDER_REVIEW,
    ReportStatus.DRAFT,
    ReportStatus.REJECTED,
    ReportStatus.APPROVED,
  ];

  for (let i = 0; i < params.reportCount; i++) {
    const date = daysAgo(i);
    const code = `OP-${date.toISOString().slice(0, 10).replace(/-/g, '')}-${String(i + 1).padStart(4, '0')}`;
    const existing = await prisma.operationReport.findFirst({ where: { tenantId: tenant.id, code } });
    if (existing) continue;

    const mine = mines[i % mines.length];
    const area = areas.find((a) => a.mineId === mine.id);
    const shift = shifts[i % shifts.length];
    const status = statuses[i % statuses.length];

    const report = await prisma.operationReport.create({
      data: {
        tenantId: tenant.id,
        projectId: mine.projectId,
        mineId: mine.id,
        areaId: area?.id,
        shiftId: shift.id,
        code,
        date,
        status,
        supervisorUserId: supervisor.user.id,
        supervisorEmployeeId: employees[0]?.id,
        responsibleTenantUserId: supervisor.tenantUser.id,
        observations: `Parte de operación ${i + 1} - ${params.name}. Actividad registrada manualmente por el supervisor.`,
        createdByUserId: supervisor.user.id,
        submittedAt: status === ReportStatus.DRAFT ? null : date,
        approvedAt: status === ReportStatus.APPROVED ? date : null,
        rejectedAt: status === ReportStatus.REJECTED ? date : null,
        version: 1,
      },
    });

    await prisma.operationActivity.create({
      data: {
        tenantId: tenant.id,
        reportId: report.id,
        areaId: area?.id,
        description: mine.mode === MineMode.OPEN_PIT ? 'Extracción y acarreo de mineral' : 'Avance de galería y sostenimiento',
        startAt: new Date(date.getTime() + 7 * 3600 * 1000),
        endAt: new Date(date.getTime() + 15 * 3600 * 1000),
        hours: 8,
      },
    });

    const productionValues: Array<[string, number]> = [
      ['EXTRACTED_TONNES', 420 + i * 35],
      ['TRANSPORTED_TONNES', 390 + i * 30],
      ['ADVANCE_METERS', mine.mode === MineMode.UNDERGROUND ? 3.5 + i * 0.2 : 0],
      ['OPERATION_HOURS', 8],
      ['DRILLING_COUNT', 24 + i],
    ];
    for (const [indicatorCode, value] of productionValues) {
      if (value <= 0) continue;
      await prisma.productionRecord.create({
        data: {
          tenantId: tenant.id,
          reportId: report.id,
          indicatorId: indicators[indicatorCode],
          unitId: units[['EXTRACTED_TONNES', 'TRANSPORTED_TONNES'].includes(indicatorCode) ? 'TON' : indicatorCode === 'ADVANCE_METERS' ? 'MT' : indicatorCode === 'OPERATION_HOURS' ? 'HR' : 'UND'],
          value,
        },
      });
    }

    for (let e = 0; e < Math.min(4, employees.length); e++) {
      await prisma.reportEmployee.create({
        data: {
          tenantId: tenant.id,
          reportId: report.id,
          employeeId: employees[(i + e) % employees.length].id,
          hours: 8,
          role: e === 0 ? 'Supervisor' : 'Operación',
        },
      });
    }
    for (let e = 0; e < Math.min(2, equipment.length); e++) {
      await prisma.reportEquipment.create({
        data: {
          tenantId: tenant.id,
          reportId: report.id,
          equipmentId: equipment[(i + e) % equipment.length].id,
          hours: 7.5,
          fuelLiters: 160 + e * 15,
        },
      });
    }

    if (status === ReportStatus.APPROVED) {
      await prisma.reportApproval.create({
        data: {
          tenantId: tenant.id,
          reportId: report.id,
          reviewerId: admin.user.id,
          decision: ApprovalDecision.APPROVED,
          comments: 'Revisado y aprobado. Producción conforme al plan.',
          decidedAt: date,
        },
      });
      await prisma.notification.create({
        data: {
          tenantId: tenant.id,
          userId: supervisor.user.id,
          title: 'Parte aprobado',
          body: `El parte ${code} fue aprobado por la administración.`,
          link: '/operations',
        },
      });
    } else if (status === ReportStatus.REJECTED) {
      await prisma.reportApproval.create({
        data: {
          tenantId: tenant.id,
          reportId: report.id,
          reviewerId: admin.user.id,
          decision: ApprovalDecision.REJECTED,
          comments: 'Falta adjuntar fotografía del frente de trabajo.',
          decidedAt: date,
        },
      });
    }

    await prisma.reportRevision.create({
      data: {
        tenantId: tenant.id,
        reportId: report.id,
        version: 1,
        snapshot: { code, date: date.toISOString(), status: ReportStatus.DRAFT },
        reason: 'Creación del parte diario',
        changedByUserId: supervisor.user.id,
        changedAt: date,
      },
    });

    await prisma.auditLog.create({
      data: {
        tenantId: tenant.id,
        actorId: supervisor.user.id,
        action: AuditAction.CREATE,
        entityType: 'OperationReport',
        entityId: report.id,
        after: { code, status },
        createdAt: date,
      },
    });
  }

  // Adjunto ficticio no binario para demostrar el módulo de evidencias.
  const firstReport = await prisma.operationReport.findFirst({ where: { tenantId: tenant.id }, orderBy: { date: 'desc' } });
  if (firstReport && !(await prisma.reportAttachment.findFirst({ where: { reportId: firstReport.id } }))) {
    await prisma.reportAttachment.create({
      data: {
        tenantId: tenant.id,
        reportId: firstReport.id,
        kind: AttachmentKind.DOCUMENT,
        fileName: 'checklist-operativo.txt',
        storageKey: `${tenant.id}/reports/demo-checklist.txt`,
        url: null,
        mimeType: 'text/plain',
        sizeBytes: 128,
        uploadedByUserId: supervisor.user.id,
      },
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
