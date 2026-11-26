-- Defensa en profundidad a nivel PostgreSQL: impedir relaciones entre filas
-- de distintos tenants incluso si un servicio comete un error.
-- El tenantId siempre se obtiene del token JWT verificado en backend.

CREATE OR REPLACE FUNCTION check_same_tenant() RETURNS trigger AS $$
DECLARE
  related_tenant text;
  field_value text;
BEGIN
  field_value := to_jsonb(NEW) ->> TG_ARGV[1];
  IF field_value IS NULL THEN
    RETURN NEW;
  END IF;

  EXECUTE format('SELECT "tenantId" FROM %I WHERE id = $1', TG_ARGV[0])
  INTO related_tenant
  USING field_value;

  IF related_tenant IS NOT NULL AND related_tenant <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Relación de tenant inválida: % (%) no pertenece al tenant %',
      TG_ARGV[0], field_value, NEW."tenantId"
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Yacimientos -> proyectos
CREATE TRIGGER trg_mines_project_tenant BEFORE INSERT OR UPDATE ON "mine"
  FOR EACH ROW EXECUTE FUNCTION check_same_tenant('project', 'projectId');

-- Sectores -> yacimientos
CREATE TRIGGER trg_areas_mine_tenant BEFORE INSERT OR UPDATE ON "mine_area"
  FOR EACH ROW EXECUTE FUNCTION check_same_tenant('mine', 'mineId');

-- Cuadrillas -> proyectos
CREATE TRIGGER trg_crews_project_tenant BEFORE INSERT OR UPDATE ON "crew"
  FOR EACH ROW EXECUTE FUNCTION check_same_tenant('project', 'projectId');

-- Empleados -> proyectos / cuadrillas / turnos
CREATE TRIGGER trg_employees_project_tenant BEFORE INSERT OR UPDATE ON "employee"
  FOR EACH ROW EXECUTE FUNCTION check_same_tenant('project', 'projectId');
CREATE TRIGGER trg_employees_crew_tenant BEFORE INSERT OR UPDATE ON "employee"
  FOR EACH ROW EXECUTE FUNCTION check_same_tenant('crew', 'crewId');
CREATE TRIGGER trg_employees_shift_tenant BEFORE INSERT OR UPDATE ON "employee"
  FOR EACH ROW EXECUTE FUNCTION check_same_tenant('shift', 'shiftId');

-- Maquinaria -> proyectos / categorías
CREATE TRIGGER trg_equipment_project_tenant BEFORE INSERT OR UPDATE ON "equipment"
  FOR EACH ROW EXECUTE FUNCTION check_same_tenant('project', 'projectId');
CREATE TRIGGER trg_equipment_category_tenant BEFORE INSERT OR UPDATE ON "equipment"
  FOR EACH ROW EXECUTE FUNCTION check_same_tenant('equipment_category', 'categoryId');

-- Parte diario -> proyecto / yacimiento / sector / turno
CREATE TRIGGER trg_reports_project_tenant BEFORE INSERT OR UPDATE ON "operation_report"
  FOR EACH ROW EXECUTE FUNCTION check_same_tenant('project', 'projectId');
CREATE TRIGGER trg_reports_mine_tenant BEFORE INSERT OR UPDATE ON "operation_report"
  FOR EACH ROW EXECUTE FUNCTION check_same_tenant('mine', 'mineId');
CREATE TRIGGER trg_reports_area_tenant BEFORE INSERT OR UPDATE ON "operation_report"
  FOR EACH ROW EXECUTE FUNCTION check_same_tenant('mine_area', 'areaId');
CREATE TRIGGER trg_reports_shift_tenant BEFORE INSERT OR UPDATE ON "operation_report"
  FOR EACH ROW EXECUTE FUNCTION check_same_tenant('shift', 'shiftId');

-- Producción -> indicadores / unidades / reportes
CREATE TRIGGER trg_production_indicator_tenant BEFORE INSERT OR UPDATE ON "production_record"
  FOR EACH ROW EXECUTE FUNCTION check_same_tenant('production_indicator', 'indicatorId');
CREATE TRIGGER trg_production_unit_tenant BEFORE INSERT OR UPDATE ON "production_record"
  FOR EACH ROW EXECUTE FUNCTION check_same_tenant('production_unit', 'unitId');
CREATE TRIGGER trg_production_report_tenant BEFORE INSERT OR UPDATE ON "production_record"
  FOR EACH ROW EXECUTE FUNCTION check_same_tenant('operation_report', 'reportId');

-- Objetivos -> proyecto / yacimiento / sector / indicador
CREATE TRIGGER trg_targets_project_tenant BEFORE INSERT OR UPDATE ON "production_target"
  FOR EACH ROW EXECUTE FUNCTION check_same_tenant('project', 'projectId');
CREATE TRIGGER trg_targets_indicator_tenant BEFORE INSERT OR UPDATE ON "production_target"
  FOR EACH ROW EXECUTE FUNCTION check_same_tenant('production_indicator', 'indicatorId');
